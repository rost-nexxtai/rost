'use server';

import { cookies } from 'next/headers';
import { LANG_COOKIE, toLang } from './lang';

/** Saves the language choice for a year. The page refreshes itself afterwards. */
export async function setLang(lang: string): Promise<void> {
  (await cookies()).set(LANG_COOKIE, toLang(lang), { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
}
