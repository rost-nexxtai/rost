'use client';

import Link from 'next/link';
import type { Foundation } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    first: 'Întâi fundația',
    debtTitle: 'Datoriile scumpe',
    debtBody: 'Un card de credit sau un credit de nevoi personale costă de obicei mai mult decât aduce orice economie. Le închidem întâi pe ele.',
    soon: 'Lecția vine în curând',
    months: (m: number) => (m < 1 ? 'mai puțin de o lună' : m === 1 ? 'o lună' : `${m} luni`),
    fundTitle: 'Fondul de urgență',
    fundBody: (months: string) => `Acum ai bani pentru ${months}. Ținta: 3 luni de cheltuieli, într-un loc din care îi scoți oricând. Abia apoi are sens să investești.`,
    learn: 'Învață în 3 minute',
  },
  {
    first: 'Foundations first',
    debtTitle: 'Expensive debt',
    debtBody: 'A credit card or a personal loan usually costs more than any saving earns. We clear those first.',
    soon: 'Lesson coming soon',
    months: (m) => (m < 1 ? 'less than a month' : m === 1 ? 'one month' : `${m} months`),
    fundTitle: 'Your emergency fund',
    fundBody: (months) => `Right now you have money for ${months}. The target: 3 months of spending, somewhere you can take it out any time. Only then does investing make sense.`,
    learn: 'Learn it in 3 minutes',
  },
);

/** "Foundations first": before any investment, a buffer and no expensive debt. Shown at every level when needed. */
export function FoundationCard({ kind, bufferMonths }: { kind: NonNullable<Foundation>; bufferMonths: number }) {
  const t = T[useLang().lang];
  if (kind === 'datorii_scumpe') {
    return (
      <section className="card card-accent" aria-labelledby="fundatia">
        <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
          {t.first}
        </span>
        <h2 id="fundatia">{t.debtTitle}</h2>
        <p className="small">{t.debtBody}</p>
        <button className="btn btn-secondary btn-sm" disabled style={{ alignSelf: 'flex-start' }}>
          {t.soon}
        </button>
      </section>
    );
  }
  return (
    <section className="card card-accent" aria-labelledby="fundatia">
      <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>
        {t.first}
      </span>
      <h2 id="fundatia">{t.fundTitle}</h2>
      <p className="small">{t.fundBody(t.months(bufferMonths))}</p>
      <Link href="/moment/lib/fondul_urgenta" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
        {t.learn}
      </Link>
    </section>
  );
}
