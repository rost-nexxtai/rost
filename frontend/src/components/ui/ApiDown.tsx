'use client';

import { useRouter } from 'next/navigation';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy({ title: 'Nu ne putem conecta acum', retry: 'Încearcă din nou' }, { title: "We can't connect right now", retry: 'Try again' });

/** Calm notice when the backend can't be reached. Fixture-backed content keeps rendering around it. */
export function ApiDown({ what }: { what: string }) {
  const router = useRouter();
  const t = T[useLang().lang];
  return (
    <section className="card" role="status">
      <h3>{t.title}</h3>
      <p className="small muted">{what}</p>
      <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => router.refresh()}>
        {t.retry}
      </button>
    </section>
  );
}
