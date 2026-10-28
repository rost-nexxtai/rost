'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Money } from '@/components/ui/Money';
import { Slider } from '@/components/ui/Slider';
import { SourceLink } from '@/components/ui/SourceLink';
import { saveMoneyLine } from '@/data/actions';
import { savingsLossLei, spendImpactLei } from '@/data/mock/stiri';
import type { MoneyLines, NewsItem } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    line: { fuelLei: { what: 'carburant', price: 'prețul carburantului' }, electricityLei: { what: 'curent', price: 'factura la curent' } } as Record<
      'fuelLei' | 'electricityLei',
      { what: string; price: string }
    >,
    meaning: 'Ce înseamnă pentru tine',
    scenario: 'scenariu, nu prognoză',
    more: 'Află mai mult',
    askSpend: (what: string) => `Cam cât dai pe ${what} pe lună?`,
    perMonth: 'pe lună',
    ifRises: (price: string) => `Dacă ${price} crește cu`,
    spendNote: (spend: string, what: string, pct: number) => `Pe cei ${spend} pe care îi dai lunar pe ${what}. Pornim de la ${pct}%, estimarea din sursă.`,
    askSaved: 'Cam cât ai pus deoparte?',
    onSaved: (saved: string, pct: string) => `Pe ${saved} puși deoparte, cu inflația ta de ${pct}, într-un an:`,
    current: 'În cont curent',
    inAlt: (label: string, pct: string) => `În ${label} (${pct}, fără impozit)`,
    forYou: 'Îți arătăm suma pentru tine.',
  },
  {
    line: { fuelLei: { what: 'fuel', price: 'the price of fuel' }, electricityLei: { what: 'electricity', price: 'your electricity bill' } },
    meaning: 'What it means for you',
    scenario: 'a scenario, not a forecast',
    more: 'Learn more',
    askSpend: (what) => `Roughly how much do you spend on ${what} a month?`,
    perMonth: 'a month',
    ifRises: (price) => `If ${price} goes up by`,
    spendNote: (spend, what, pct) => `On the ${spend} you spend on ${what} each month. We start from ${pct}%, the estimate in the source.`,
    askSaved: 'Roughly how much have you put aside?',
    onSaved: (saved, pct) => `On ${saved} put aside, with your inflation of ${pct}, over a year:`,
    current: 'In a current account',
    inAlt: (label, pct) => `In ${label} (${pct}, tax-free)`,
    forYou: "We'll show you the amount for you.",
  },
);

/** One news item: dated facts with sources, then what it means in lei for this user, as a scenario. */
export function NewsCard({ item, money }: { item: NewsItem; money: MoneyLines }) {
  const t = T[useLang().lang];
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
            {t.meaning}
          </span>
          <span className="tag tag-scenario">{t.scenario}</span>
        </div>
        {item.impact.kind === 'spend' ? <SpendImpact impact={item.impact} money={money} /> : <SavingsImpact impact={item.impact} money={money} />}
      </div>

      <Link href={item.momentHref} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>
        {t.more}
      </Link>
    </article>
  );
}

function SpendImpact({ impact, money }: { impact: Extract<NewsItem['impact'], { kind: 'spend' }>; money: MoneyLines }) {
  const [shock, setShock] = useState(impact.shock.defaultPct);
  const spend = money[impact.line];
  const { lang, f } = useLang();
  const t = T[lang];
  const line = t.line[impact.line];
  if (spend <= 0) {
    return <AskAmount line={impact.line} question={t.askSpend(line.what)} amounts={impact.line === 'fuelLei' ? [200, 400, 600] : [100, 150, 250]} />;
  }
  return (
    <>
      <div className="row" style={{ alignItems: 'baseline' }}>
        <Money lei={spendImpactLei(spend, shock)} signed size="md" tone="neg" />
        <span className="small muted">{t.perMonth}</span>
      </div>
      <Slider label={t.ifRises(line.price)} min={impact.shock.minPct} max={impact.shock.maxPct} step={1} value={shock} onChange={setShock} format={(v) => `${v}%`} />
      <p className="note">
        {t.spendNote(f.lei(spend), line.what, impact.shock.defaultPct)}
      </p>
    </>
  );
}

function SavingsImpact({ impact, money }: { impact: Extract<NewsItem['impact'], { kind: 'savings' }>; money: MoneyLines }) {
  const { lang, f } = useLang();
  const t = T[lang];
  if (money.savedLei <= 0) {
    return <AskAmount line="savedLei" question={t.askSaved} amounts={[1000, 5000, 10000]} />;
  }
  const cash = savingsLossLei(money.savedLei, money.inflationPct);
  const alt = savingsLossLei(money.savedLei, money.inflationPct, impact.alternative.ratePct);
  return (
    <>
      <p className="small">
        {t.onSaved(f.lei(money.savedLei), f.pct(money.inflationPct, 2))}
      </p>
      <div className="list-row" style={{ padding: '6px 0' }}>
        <span className="small">{t.current}</span>
        <Money lei={cash} signed tone={cash < 0 ? 'neg' : 'pos'} />
      </div>
      <div className="list-row" style={{ padding: '6px 0' }}>
        <span className="small">
          {t.inAlt(impact.alternative.label, f.pct(impact.alternative.ratePct, 2))}
        </span>
        <Money lei={alt} signed tone={alt < 0 ? 'neg' : 'pos'} />
      </div>
    </>
  );
}

/** One tap to make the card about you. Saved to the profile, then the card recomputes. */
function AskAmount({ line, question, amounts }: { line: 'fuelLei' | 'electricityLei' | 'savedLei'; question: string; amounts: number[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { lang, f } = useLang();
  const t = T[lang];
  return (
    <div className="stack">
      <p className="small">
        <strong>{question}</strong> {t.forYou}
      </p>
      <div className="tiles-row" style={{ gridTemplateColumns: `repeat(${amounts.length}, 1fr)` }}>
        {amounts.map((a) => (
          <button
            key={a}
            type="button"
            className="tile"
            style={{ minHeight: 48, padding: 8, fontSize: 15 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await saveMoneyLine(line, a);
              router.refresh();
            }}
          >
            {f.lei(a)}
          </button>
        ))}
      </div>
    </div>
  );
}
