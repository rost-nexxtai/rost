'use client';

import { useState } from 'react';
import { SimChart } from '@/components/ui/SimChart';
import { Slider } from '@/components/ui/Slider';
import { SourceLink } from '@/components/ui/SourceLink';
import { simulate, simulateRange, todayMoney } from '@/data/mock/simulation';
import type { AssetSimulation } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    start: 'Pornești cu',
    monthly: 'Pui lunar',
    years: 'Timp de',
    yearsN: (n: number) => (n === 1 ? '1 an' : `${n} ani`),
    valueAfter: (y: string) => `Valoare după ${y}`,
    paidIn: 'Ai depus',
    today: (pct: string) => `În banii de azi (inflație ${pct})`,
    fixedNote: (pct: string) => `La cea mai bună rată din listă, ${pct} pe an după impozit, presupunând că rămâne la fel. Rata se poate schimba în timp.`,
    ifDecade: (y: string) => `După ${y}, dacă piața ar repeta un deceniu…`,
    weak: 'slab',
    typical: 'tipic',
    good: 'bun',
    yearLike: (year: number, pct: string) => `Un an ca ${year}: ${pct}`,
    shortTerm: 'Pe termen scurt, valoarea poate scădea mult. Seriile de mai sus sunt istorice, nu o prognoză.',
    sourceA: 'Randamente anuale pe perioade de 10 ani, calculate de noi din',
    sourceB: 'În dolari, înainte de comisioane și taxe.',
  },
  {
    start: 'You start with',
    monthly: 'Monthly',
    years: 'For',
    yearsN: (n) => (n === 1 ? '1 year' : `${n} years`),
    valueAfter: (y) => `Value after ${y}`,
    paidIn: 'You paid in',
    today: (pct) => `In today's money (inflation ${pct})`,
    fixedNote: (pct) => `At the best rate in the list, ${pct} a year after tax, assuming it stays the same. Rates can change over time.`,
    ifDecade: (y) => `After ${y}, if the market repeated a decade…`,
    weak: 'weak',
    typical: 'typical',
    good: 'good',
    yearLike: (year, pct) => `A year like ${year}: ${pct}`,
    shortTerm: 'In the short term the value can fall a lot. The series above are historical, not a forecast.',
    sourceA: 'Yearly returns over 10-year periods, worked out by us from',
    sourceB: 'In dollars, before fees and taxes.',
  },
);

function useSim() {
  const { lang, f } = useLang();
  return { t: T[lang], lei: f.lei, pct: f.pct };
}

/** Sliders for start amount, monthly amount and years; the chart redraws as they move. */
export function Simulation({ basis, ratePct, inflationPct }: { basis: AssetSimulation; ratePct?: number; inflationPct: number }) {
  const [startLei, setStart] = useState(5000);
  const [monthlyLei, setMonthly] = useState(400);
  const [years, setYears] = useState(10);
  const input = { startLei, monthlyLei, years };
  const { t, lei } = useSim();

  return (
    <div className="stack-lg">
      {basis.kind === 'fixed' && ratePct !== undefined ? (
        <FixedResult input={input} ratePct={ratePct} inflationPct={inflationPct} />
      ) : basis.kind === 'range' ? (
        <RangeResult input={input} basis={basis} />
      ) : null}

      <div className="stack">
        <Slider label={t.start} min={0} max={100000} step={500} value={startLei} onChange={setStart} format={lei} />
        <Slider label={t.monthly} min={0} max={5000} step={50} value={monthlyLei} onChange={setMonthly} format={lei} />
        <Slider label={t.years} min={1} max={40} step={1} value={years} onChange={setYears} format={t.yearsN} />
      </div>
    </div>
  );
}

type Input = { startLei: number; monthlyLei: number; years: number };

function FixedResult({ input, ratePct, inflationPct }: { input: Input; ratePct: number; inflationPct: number }) {
  const { value, paidIn } = simulate({ ...input, ratePct });
  const { t, lei, pct } = useSim();
  const today = todayMoney(value, inflationPct);
  const end = (p: { valueLei: number }[]) => p.at(-1)?.valueLei ?? 0;
  return (
    <>
      <div className="stack" style={{ gap: 2 }}>
        <span className="small muted">{t.valueAfter(t.yearsN(input.years))}</span>
        <span className="money display-xl pos">{lei(end(value))}</span>
      </div>
      <div className="grid2">
        <Stat label={t.paidIn} value={lei(end(paidIn))} />
        <Stat label={t.today(pct(inflationPct, 2))} value={lei(end(today))} />
      </div>
      <SimChart kind="fixed" value={value} paidIn={paidIn} today={today} />
      <p className="note">{t.fixedNote(pct(ratePct, 2))}</p>
    </>
  );
}

function RangeResult({ input, basis }: { input: Input; basis: Extract<AssetSimulation, { kind: 'range' }> }) {
  const r = simulateRange(input, basis);
  const { t, lei, pct } = useSim();
  const end = (p: { valueLei: number }[]) => p.at(-1)?.valueLei ?? 0;
  return (
    <>
      <div className="stack" style={{ gap: 0 }}>
        <span className="small muted">{t.ifDecade(t.yearsN(input.years))}</span>
        <RangeRow label={t.weak} value={lei(end(r.worst))} />
        <RangeRow label={t.typical} value={lei(end(r.typical))} strong />
        <RangeRow label={t.good} value={lei(end(r.best))} />
      </div>
      <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} />
      <div className="card card-accent" style={{ padding: 14, gap: 4 }}>
        <strong className="small">
          {t.yearLike(basis.worstYear.year, pct(basis.worstYear.pct, 1))}
        </strong>
        <p className="small">{t.shortTerm}</p>
      </div>
      {basis.note && <p className="small">{basis.note}</p>}
      <p className="note">
        {t.sourceA} <SourceLink label={basis.source.label} url={basis.source.url} />. {t.sourceB}
      </p>
    </>
  );
}

function RangeRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="list-row" style={{ padding: '8px 0' }}>
      <span className="small">{label}</span>
      <span className={`money ${strong ? 'h2 pos' : ''}`} style={strong ? undefined : { fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className={`money ${strong ? 'h2 pos' : ''}`} style={strong ? undefined : { fontWeight: 700, fontSize: 17 }}>
        {value}
      </span>
      <span className="note">{label}</span>
    </div>
  );
}
