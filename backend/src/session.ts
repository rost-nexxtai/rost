import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

export const UID_COOKIE = 'rost_uid';

/** No accounts in the MVP: a cookie holds the user id set at onboarding. */
export function currentUserId(c: Context): string | undefined {
  return getCookie(c, UID_COOKIE);
}

export function setUserId(c: Context, userId: string): void {
  setCookie(c, UID_COOKIE, userId, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 90 });
}

export function clearUserId(c: Context): void {
  deleteCookie(c, UID_COOKIE, { path: '/' });
}
