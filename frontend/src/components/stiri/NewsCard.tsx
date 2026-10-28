'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Money } from '@/components/ui/Money';
import { Slider } from '@/components/ui/Slider';
import { SourceLink } from '@/components/ui/SourceLink';
import { savingsLossLei, spendImpactLei } from '@/data/mock/stiri';
import type { MoneyLines, NewsItem } from '@/data/types';
import { lei, pct } from '@/lib/format';

const LINE = { fuelLei: { what: 'carburant', price: 'prețul carburantului' }, electricityLei: { what: 'curent', price: 'factura la curent' } } as const;

/** One news item: dated facts with sources, then what it means in lei for this user, as a scenario. */
export function NewsCard({ item, money }: { item: NewsItem; money: MoneyLines }) {
  return (
    <article className="card" aria-labelledby={`n-${item.id}`}>
      <span className="eyebrow">{item.date}</span>
      <h2 id={`n-${item.id}`} style={{ fontSize: 19 }}>
        {item.title}
      </h2>
      <ul className="small" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {item.facts.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <div className="stack" style={{ gap: 2 }}>
        {item.sources.map((s) => (
          <SourceLink key={s.url} label={s.label} url={s.url} date={s.date} />
        ))}
      </div>

      <div className="card card-tint" style={{ padding: 16 }}>
        <div className="row">
          <span className="eyebrow" style={{ color: 'var(--primary)' }}>
            Ce înseamnă pentru tine
          </span>
          <span className="tag tag-scenario">scenariu, nu prognoză</span>
        </div>
        {item.impact.kind === 'spend' ? <SpendImpact impact={item.impact} money={money} /> : <SavingsImpact impact={item.impact} money={money} />}
      </div>

      <Link href={item.momentHref} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        Află mai mult
      </Link>
    </article>
  );
}

function SpendImpact({ impact, money }: { impact: Extract<NewsItem['impact'], { kind: 'spend' }>; money: MoneyLines }) {
  const [shock, setShock] = useState(impact.shock.defaultPct);
  const spend = money[impact.line];
  const line = LINE[impact.line];
  if (spend <= 0) {
    return <p className="small">Nu ne-ai spus cât dai pe {line.what}. Refă testul ca să vezi suma pentru tine.</p>;
  }
  return (
    <>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <Money lei={spendImpactLei(spend, shock)} signed size="md" tone="neg" />
        <span className="small muted">pe lună</span>
      </div>
      <Slider label={`Dacă ${line.price} crește cu`} min={impact.shock.minPct} max={impact.shock.maxPct} step={1} value={shock} onChange={setShock} format={(v) => `${v}%`} />
      <p className="note">
        Pe cei {lei(spend)} pe care îi dai lunar pe {line.what}. Pornim de la {impact.shock.defaultPct}%, estimarea din sursă.
      </p>
    </>
  );
}

function SavingsImpact({ impact, money }: { impact: Extract<NewsItem['impact'], { kind: 'savings' }>; money: MoneyLines }) {
  if (money.savedLei <= 0) {
    return <p className="small">Nu ne-ai spus cât ai pus deoparte. Refă testul ca să vezi suma pentru tine.</p>;
  }
  const cash = savingsLossLei(money.savedLei, money.inflationPct);
  const alt = savingsLossLei(money.savedLei, money.inflationPct, impact.alternative.ratePct);
  return (
    <>
      <p className="small">
        Pe {lei(money.savedLei)} puși deoparte, cu inflația ta de {pct(money.inflationPct, 2)}, într-un an:
      </p>
      <div className="list-row" style={{ padding: '6px 0' }}>
        <span className="small">În cont curent</span>
        <Money lei={cash} signed tone={cash < 0 ? 'neg' : 'pos'} />
      </div>
      <div className="list-row" style={{ padding: '6px 0' }}>
        <span className="small">
          În {impact.alternative.label} ({pct(impact.alternative.ratePct, 2)}, fără impozit)
        </span>
        <Money lei={alt} signed tone={alt < 0 ? 'neg' : 'pos'} />
      </div>
    </>
  );
}
