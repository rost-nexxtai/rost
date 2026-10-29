/** The session cookie: a random token the backend set (HttpOnly). */
export const SESSION_COOKIE = 'rost_session';
/** The cookie before sessions: the raw user id. The backend swaps it for a session while LEGACY_UID_COOKIE is on. */
export const LEGACY_UID_COOKIE = 'rost_uid';
/** The profile the app kept in the browser before the backend did (JSON). Imported once, then deleted. */
export const LEGACY_PROFILE_COOKIE = 'rost_profile';
/** Set for a day after the session cookie is renewed, so it's renewed at most once a day. */
export const RENEWED_COOKIE = 'rost_renewed';
/** Like the backend's app.SessionTTL. */
export const SESSION_MAX_AGE = 90 * 24 * 60 * 60;

type CookieJar = { has(name: string): boolean };

/** Whether the browser sent a session, or an old cookie that becomes one. Says nothing about whether it's still valid. */
export function hasSessionCookie(jar: CookieJar): boolean {
  return jar.has(SESSION_COOKIE) || jar.has(LEGACY_UID_COOKIE);
}

/** The session token in a backend answer's Set-Cookie headers, if it set one. */
export function sessionFromSetCookie(setCookies: string[]): string | undefined {
  for (const header of setCookies) {
    const [pair] = header.split(';');
    const eq = pair.indexOf('=');
    if (eq < 0 || pair.slice(0, eq).trim() !== SESSION_COOKIE) continue;
    const value = pair.slice(eq + 1).trim();
    if (value) return value;
  }
  return undefined;
}

/** A Cookie header with the old cookie swapped for the session. Values are encoded again, as the parsed ones came decoded. */
export function withSession(cookies: { name: string; value: string }[], token: string): string {
  return cookies
    .filter((c) => c.name !== SESSION_COOKIE && c.name !== LEGACY_UID_COOKIE)
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .concat(`${SESSION_COOKIE}=${token}`)
    .join('; ');
}

/** Whether the browser reached us over https: the proxy in front says so, or the URL does. */
export function isHttps(headers: { get(name: string): string | null }, url: string): boolean {
  const proto = headers.get('x-forwarded-proto')?.split(',')[0].trim();
  return proto ? proto === 'https' : url.startsWith('https:');
}

/** A Set-Cookie header with the attributes the backend gives the session cookie. maxAge 0 deletes it. */
export function cookieHeader(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

/**
 * Whether POST /api/me/import is done with the old profile cookie: imported, or nothing to import (a
 * cookie the old app couldn't have written, a user who already has a profile, or the import turned off
 * with the old-cookie swap). Anything else is tried again on the next page.
 */
export function importSettled(status: number): boolean {
  return (status >= 200 && status < 300) || status === 400 || status === 404 || status === 409;
}

/** The headers a server-side call to the backend passes on, so its rate limits see the browser, not this server. */
export function forwardedHeaders(incoming: { get(name: string): string | null }): Record<string, string> {
  const xff = incoming.get('x-forwarded-for');
  return xff ? { 'x-forwarded-for': xff } : {};
}
