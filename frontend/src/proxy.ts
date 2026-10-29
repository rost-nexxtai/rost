import { NextResponse, type NextRequest } from 'next/server';
import {
  cookieHeader,
  forwardedHeaders,
  importSettled,
  isHttps,
  LEGACY_PROFILE_COOKIE,
  LEGACY_UID_COOKIE,
  RENEWED_COOKIE,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  sessionFromSetCookie,
  withSession,
} from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';
/** A hung API must not stall every page: past this the page renders as if the call failed. */
const BACKEND_TIMEOUT_MS = 5000;

/**
 * Runs before a page renders. Pages call the backend from the server (lib/api.ts), where a cookie the
 * backend sets never reaches the browser, so what changes the browser's cookies happens here, where the
 * page and the browser both get it:
 * - swaps the old `rost_uid` cookie for a session (the backend makes it);
 * - moves the old `rost_profile` cookie to the backend once (POST /api/me/import), then deletes it;
 * - sets the session cookie again, at most once a day, so it lives 90 days from the last visit like the
 *   session on the server, not 90 days from sign-in.
 * The first two go when the backend's LEGACY_UID_COOKIE does.
 */
export async function proxy(request: NextRequest) {
  const forwarded = forwardedHeaders(request.headers);
  const backend = (path: string, init: RequestInit) =>
    fetch(`${BACKEND_URL}${path}`, {
      ...init,
      headers: { ...forwarded, ...init.headers },
      cache: 'no-store',
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    }).catch(() => undefined);
  const setCookies: string[] = [];
  const sent = request.cookies.get(SESSION_COOKIE)?.value;
  let token = sent;

  const uid = request.cookies.get(LEGACY_UID_COOKIE)?.value;
  if (uid && !token) {
    const res = await backend('/api/me', { headers: { cookie: `${LEGACY_UID_COOKIE}=${uid}` } });
    if (res) {
      setCookies.push(...res.headers.getSetCookie());
      token = sessionFromSetCookie(setCookies);
    }
  }

  let profileDone = false;
  const profile = request.cookies.get(LEGACY_PROFILE_COOKIE)?.value;
  // Without a session, only when this browser had no old id: one with an id waits for the swap (the
  // next visit, if it failed now), or the import would make a second account beside the old one.
  if (profile && (token || !uid)) {
    const res = await backend('/api/me/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(token && { cookie: `${SESSION_COOKIE}=${token}` }) },
      body: profile,
    });
    if (res) {
      const set = res.headers.getSetCookie();
      setCookies.push(...set);
      token = sessionFromSetCookie(set) ?? token;
      profileDone = importSettled(res.status);
    }
  }

  const secure = isHttps(request.headers, request.url);
  const renew = !!token && !request.cookies.has(RENEWED_COOKIE);
  if (renew && token === sent) setCookies.push(cookieHeader(SESSION_COOKIE, token!, SESSION_MAX_AGE, secure));
  if (renew) setCookies.push(cookieHeader(RENEWED_COOKIE, '1', 24 * 60 * 60, secure));
  if (profileDone) setCookies.push(cookieHeader(LEGACY_PROFILE_COOKIE, '', 0, secure));

  let response = NextResponse.next();
  if (token && token !== sent) {
    const headers = new Headers(request.headers);
    headers.set('cookie', withSession(request.cookies.getAll(), token));
    response = NextResponse.next({ request: { headers } });
  }
  for (const c of setCookies) response.headers.append('set-cookie', c);
  return response;
}

export const config = {
  // pages only: /api/* goes straight to the backend, which does the swap itself; /healthz is the container's
  matcher: ['/((?!api/|_next/|favicon.ico|healthz).*)'],
};
