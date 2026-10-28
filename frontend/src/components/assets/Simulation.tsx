'use client';

import { useState } from 'react';
import { SimChart } from '@/components/ui/SimChart';
import { Slider } from '@/components/ui/Slider';
import { SourceLink } from '@/components/ui/SourceLink';
import { inflationImpact, simulate, simulateRange, todayMoney, type InflationImpact } from '@/data/mock/simulation';
import type { AssetSimulation } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    start: 'Pornești cu',
    monthly: 'Pui lunar',
    years: 'Timp de',
    inflation: 'Inflație pe an',
    inflationYours: (pct: string) => `Pornește de la inflația ta, ${pct}. Mut-o ca să vezi ce se întâmplă dacă urcă.`,
    inflationNational: (pct: string) => `Pornește de la inflația națională, ${pct}. Spune-ne pe ce cheltui (Profil → Banii tăi) și calculăm cu a ta.`,
    yearsN: (n: number) => (n === 1 ? '1 an' : `${n} ani`),
    paper: 'Pe hârtie',
    real: 'În banii de azi',
    vsPaid: (paid: string) => `Față de ce ai depus (${paid}, adică atât în banii de azi)`,
    beats: (rate: string) => `Randament real: ${rate} pe an. Rata bate inflația, deci banii chiar cresc.`,
    loses: (rate: string) => `Randament real: ${rate} pe an. Rata e sub inflație: suma crește pe hârtie, dar cumpără tot mai puțin.`,
    fixedNote: (pct: string) => `La cea mai bună rată din listă, ${pct} pe an după impozit, presupunând că rata și inflația rămân la fel. Ambele se pot schimba.`,
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
    inflation: 'Inflation a year',
    inflationYours: (pct) => `Starts at your inflation, ${pct}. Move it to see what happens if it rises.`,
    inflationNational: (pct) => `Starts at the national inflation, ${pct}. Tell us how you spend (Profile → Your money) and we'll use yours.`,
    yearsN: (n) => (n === 1 ? '1 year' : `${n} years`),
    paper: 'On paper',
    real: "In today's money",
    vsPaid: (paid) => `Against what you paid in (${paid}, in today's money)`,
    beats: (rate) => `Real return: ${rate} a year. The rate beats inflation, so your money really grows.`,
    loses: (rate) => `Real return: ${rate} a year. The rate is below inflation: the amount grows on paper but buys less and less.`,
    fixedNote: (pct) => `At the best rate in the list, ${pct} a year after tax, assuming the rate and inflation stay the same. Both can change.`,
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
  return { t: T[lang], lei: f.lei, leiSigned: f.leiSigned, pct: f.pct };
}

/** Sliders for start amount, monthly amount, years and inflation; the result and chart redraw as they move. */
export function Simulation({
  basis,
  ratePct,
  inflationPct,
  inflationPersonal = false,
  savedLei,
}: {
  basis: AssetSimulation;
  ratePct?: number;
  inflationPct: number;
  inflationPersonal?: boolean;
  /** What the user has saved: the starting amount, when we know it. */
  savedLei?: number;
}) {
  const [startLei, setStart] = useState(savedLei !== undefined ? Math.min(100000, Math.round(savedLei / 500) * 500) : 5000);
  const [monthlyLei, setMonthly] = useState(400);
  const [years, setYears] = useState(10);
  const [inflation, setInflation] = useState(inflationPct);
  const input = { startLei, monthlyLei, years };
  const { t, lei, pct } = useSim();

  return (
    <div className="stack-lg">
      {basis.kind === 'fixed' && ratePct !== undefined ? (
        <FixedResult input={input} ratePct={ratePct} inflationPct={inflation} />
      ) : basis.kind === 'range' ? (
        <RangeResult input={input} basis={basis} inflationPct={inflation} />
      ) : null}

      <div className="stack">
        <Slider label={t.start} min={0} max={100000} step={500} value={startLei} onChange={setStart} format={lei} />
        <Slider label={t.monthly} min={0} max={5000} step={50} value={monthlyLei} onChange={setMonthly} format={lei} />
        <Slider label={t.years} min={1} max={40} step={1} value={years} onChange={setYears} format={t.yearsN} />
        <Slider label={t.inflation} min={0} max={15} step={0.5} value={inflation} onChange={setInflation} format={(v) => pct(v, 1)} />
        <p className="note">{inflationPersonal ? t.inflationYours(pct(inflationPct, 2)) : t.inflationNational(pct(inflationPct, 2))}</p>
      </div>
    </div>
  );
}

type Input = { startLei: number; monthlyLei: number; years: number };

function FixedResult({ input, ratePct, inflationPct }: { input: Input; ratePct: number; inflationPct: number }) {
  const { value, paidIn } = simulate({ ...input, ratePct });
  const today = todayMoney(value, inflationPct);
  const cash = todayMoney(simulate({ ...input, ratePct: 0 }).value, inflationPct);
  const impact = inflationImpact({ ...input, ratePct, inflationPct });
  const { t, pct } = useSim();
  return (
    <>
      <InflationTakes impact={impact} />
      <SimChart kind="fixed" value={value} paidIn={paidIn} today={today} cash={cash} />
      <p className="note">{t.fixedNote(pct(ratePct, 2))}</p>
    </>
  );
}

function RangeResult({ input, basis, inflationPct }: { input: Input; basis: Extract<AssetSimulation, { kind: 'range' }>; inflationPct: number }) {
  const r = simulateRange(input, basis);
  const impact = inflationImpact({ ...input, ratePct: basis.typicalPct, inflationPct });
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
      <InflationTakes impact={impact} />
      <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} typicalToday={todayMoney(r.typical, inflationPct)} />
      <div className="panel-accent">
        <strong className="small">{t.yearLike(basis.worstYear.year, pct(basis.worstYear.pct, 1))}</strong>
        <p className="small">{t.shortTerm}</p>
      </div>
      {basis.note && <p className="small">{basis.note}</p>}
      <p className="note">
        {t.sourceA} <SourceLink label={basis.source.label} url={basis.source.url} />. {t.sourceB}
      </p>
    </>
  );
}

/** Paper vs today's money, against what you put in, and whether the rate beats inflation. */
function InflationTakes({ impact }: { impact: InflationImpact }) {
  const { t, lei, leiSigned, pct } = useSim();
  const beats = impact.realRatePct > 0;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="grid2">
        <Stat label={t.paper} value={lei(impact.nominalLei)} />
        <Stat label={t.real} value={lei(impact.realLei)} strong />
      </div>
      <div className="list-row" style={{ padding: '4px 0' }}>
        <span className="small">{t.vsPaid(lei(impact.paidInRealLei))}</span>
        <span className={`money ${impact.realGainLei >= 0 ? 'pos' : 'neg'}`} style={{ fontWeight: 700 }}>
          {leiSigned(impact.realGainLei)}
        </span>
      </div>
      <p className={`small ${beats ? '' : 'neg'}`} style={{ fontWeight: 600 }}>
        {beats ? t.beats(pct(impact.realRatePct, 2)) : t.loses(pct(impact.realRatePct, 2))}
      </p>
    </div>
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
      <span className={`money ${strong ? 'h2 neg' : ''}`} style={strong ? undefined : { fontWeight: 700, fontSize: 17 }}>
        {value}
      </span>
      <span className="note">{label}</span>
    </div>
  );
}
