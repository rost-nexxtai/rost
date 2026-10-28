import { DEFAULT_LANG, type Lang } from '@/i18n/lang';

const LOCALE: Record<Lang, string> = { ro: 'ro-RO', en: 'en-GB' };

const wholeFmt = (lang: Lang) => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0, useGrouping: 'always' });

/** 1500 → "1.500 lei" in Romanian, "1,500 lei" in English. Whole lei. */
export const lei = (n: number, lang: Lang = DEFAULT_LANG) => `${wholeFmt(lang).format(Math.round(n))} lei`;

/** 32 → "+32 lei", -195.4 → "−195 lei" (true minus sign), 0 → "0 lei". */
export function leiSigned(n: number, lang: Lang = DEFAULT_LANG): string {
  const r = Math.round(n);
  if (r === 0) return '0 lei';
  return `${r > 0 ? '+' : '−'}${lei(Math.abs(r), lang)}`;
}

/** 8.4812 → "8,48%" in Romanian, "8.48%" in English. */
export const pct = (n: number, digits = 1, lang: Lang = DEFAULT_LANG) =>
  `${new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n)}%`;

/** A plain number in the language's grouping, up to one decimal. */
export const num = (n: number, lang: Lang = DEFAULT_LANG) =>
  new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 1, useGrouping: 'always' }).format(n);

/** The formatters bound to one language, for components that format a lot. */
export function fmt(lang: Lang) {
  return {
    lei: (n: number) => lei(n, lang),
    leiSigned: (n: number) => leiSigned(n, lang),
    pct: (n: number, digits = 1) => pct(n, digits, lang),
    num: (n: number) => num(n, lang),
  };
}
