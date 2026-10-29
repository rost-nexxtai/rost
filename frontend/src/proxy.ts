import { NextResponse, type NextRequest } from 'next/server';
import { LEGACY_UID_COOKIE, SESSION_COOKIE, sessionFromSetCookie, withSession } from '@/lib/session';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8080';

/**
 * Swaps the old `rost_uid` cookie for a session before a page renders. Pages call the backend from the
 * server (lib/api.ts), where a cookie the backend sets never reaches the browser, so the swap is done here
 * once: the backend makes the session, and the page and the browser both get it.
 * Delete this file when the backend's LEGACY_UID_COOKIE goes.
 */
export async function proxy(request: NextRequest) {
  const uid = request.cookies.get(LEGACY_UID_COOKIE)?.value;
  if (!uid || request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const res = await fetch(`${BACKEND_URL}/api/me`, {
    headers: { cookie: `${LEGACY_UID_COOKIE}=${uid}` },
    cache: 'no-store',
  }).catch(() => undefined);
  if (!res) return NextResponse.next(); // backend down: the page handles it as before
  const setCookies = res.headers.getSetCookie();
  const token = sessionFromSetCookie(setCookies);

  const headers = new Headers(request.headers);
  if (token) headers.set('cookie', withSession(request.cookies.getAll(), token));
  const response = NextResponse.next({ request: { headers } });
  for (const c of setCookies) response.headers.append('set-cookie', c);
  return response;
}

export const config = {
  // pages only: /api/* goes straight to the backend, which does the swap itself
  matcher: ['/((?!api/|_next/|favicon.ico).*)'],
};
