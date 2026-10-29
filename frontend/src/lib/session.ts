/** The session cookie: a random token the backend set (HttpOnly). */
export const SESSION_COOKIE = 'rost_session';
/** The cookie before sessions: the raw user id. The backend swaps it for a session while LEGACY_UID_COOKIE is on. */
export const LEGACY_UID_COOKIE = 'rost_uid';

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

/** A Cookie header with the old cookie swapped for the session. */
export function withSession(cookies: { name: string; value: string }[], token: string): string {
  return cookies
    .filter((c) => c.name !== SESSION_COOKIE && c.name !== LEGACY_UID_COOKIE)
    .map((c) => `${c.name}=${c.value}`)
    .concat(`${SESSION_COOKIE}=${token}`)
    .join('; ');
}
