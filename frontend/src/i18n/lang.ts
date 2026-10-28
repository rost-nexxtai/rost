/** The two languages the app speaks. Romanian is the default; English is for everyone else. */
export type Lang = 'ro' | 'en';
export const LANGS: Lang[] = ['ro', 'en'];
export const DEFAULT_LANG: Lang = 'ro';

/** Cookie holding the choice. The Go API reads the same cookie, so moments come back in the same language. */
export const LANG_COOKIE = 'rost_lang';

export const isLang = (v: unknown): v is Lang => v === 'ro' || v === 'en';
export const toLang = (v: unknown): Lang => (isLang(v) ? v : DEFAULT_LANG);

/**
 * Text for one component, in both languages. English must have exactly the shape of Romanian,
 * so a missing or extra string is a type error, not a blank on screen.
 */
export function copy<T>(ro: T, en: NoInfer<T>): Record<Lang, T> {
  return { ro, en };
}
