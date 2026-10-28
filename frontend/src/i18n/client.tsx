'use client';

import { createContext, useContext, useMemo } from 'react';
import { fmt } from '@/lib/format';
import { DEFAULT_LANG, type Lang } from './lang';

const LangContext = createContext<Lang>(DEFAULT_LANG);

/** Set once in the root layout from the cookie, so client components render in the same language as the server. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** The current language and its formatters. */
export function useLang() {
  const lang = useContext(LangContext);
  return useMemo(() => ({ lang, f: fmt(lang) }), [lang]);
}
