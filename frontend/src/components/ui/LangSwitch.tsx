'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { setLang } from '@/i18n/actions';
import { useLang } from '@/i18n/client';
import { LANGS, type Lang } from '@/i18n/lang';

const NATIVE_NAME: Record<Lang, string> = { ro: 'Română', en: 'English' };

/** RO | EN. Saves the choice in a cookie and re-renders the page in the other language. */
export function LangSwitch() {
  const { lang } = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="lang-switch" role="group" aria-label={lang === 'ro' ? 'Limba' : 'Language'} aria-busy={pending}>
      {LANGS.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          lang={l}
          aria-label={NATIVE_NAME[l]}
          onClick={() =>
            lang !== l &&
            start(async () => {
              await setLang(l);
              router.refresh();
            })
          }
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
