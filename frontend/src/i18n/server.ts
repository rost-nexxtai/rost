import 'server-only';
import { cookies } from 'next/headers';
import { LANG_COOKIE, toLang, type Lang } from './lang';

/** The visitor's language, from the cookie. Server components and actions only. */
export async function getLang(): Promise<Lang> {
  return toLang((await cookies()).get(LANG_COOKIE)?.value);
}
