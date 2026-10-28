import 'server-only';
import { cookies } from 'next/headers';

export const UID_COOKIE = 'rost_uid';

/** No accounts in the MVP: a cookie holds the user id set at onboarding. */
export async function currentUserId(): Promise<string | undefined> {
  return (await cookies()).get(UID_COOKIE)?.value;
}

export const cookieOptions = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 90 };
