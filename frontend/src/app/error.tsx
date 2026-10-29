'use client';

import { ApiDown } from '@/components/ui/ApiDown';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  { what: 'Nu putem ajunge la server acum. Încearcă din nou peste puțin.' },
  { what: "We can't reach the server right now. Try again in a moment." },
);

/** A page that couldn't load (the backend is down, see data/index.ts): say so, never send the user to the quiz. */
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  const t = T[useLang().lang];
  return (
    <main className="shell shell-bare">
      <ApiDown what={t.what} onRetry={retry} />
    </main>
  );
}
