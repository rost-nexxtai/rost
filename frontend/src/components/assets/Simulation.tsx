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
    yearsN: (n: number) => (n === 1 ? '1 an' : `${n} ani`),
    eatsTitle: (y: string) => `În ${y}, inflația îți ia`,
    eatsBody: (paper: string, real: string) => `Pe hârtie ai ${paper}. Cu ei cumperi cât cu ${real} azi.`,
    paper: 'Pe hârtie',
    real: 'În banii de azi',
    vsPaid: (paid: string) => `Față de ce ai depus (${paid}, adică atât în banii de azi)`,
    barsTitle: 'Aceiași bani, în banii de azi',
    barCash: 'Lăsați în cont curent',
    barPaid: 'Cât ai depus',
    barHere: 'Aici, la rata din listă',
    barTypical: 'Aici, într-un deceniu tipic',
    beats: (rate: string) => `Randament real: ${rate} pe an. Rata bate inflația, deci banii chiar cresc.`,
    loses: (rate: string) => `Randament real: ${rate} pe an. Rata e sub inflație: suma crește pe hârtie, dar cumpără tot mai puțin.`,
    cashLoss: (lost: string) => `Lăsați în cont curent, aceiași bani ar pierde ${lost} din puterea de cumpărare.`,
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
    yearsN: (n) => (n === 1 ? '1 year' : `${n} years`),
    eatsTitle: (y) => `Over ${y}, inflation takes`,
    eatsBody: (paper, real) => `On paper you have ${paper}. It buys what ${real} buys today.`,
    paper: 'On paper',
    real: "In today's money",
    vsPaid: (paid) => `Against what you paid in (${paid}, in today's money)`,
    barsTitle: "The same money, in today's money",
    barCash: 'Left in a current account',
    barPaid: 'What you paid in',
    barHere: 'Here, at the rate in the list',
    barTypical: 'Here, in a typical decade',
    beats: (rate) => `Real return: ${rate} a year. The rate beats inflation, so your money really grows.`,
    loses: (rate) => `Real return: ${rate} a year. The rate is below inflation: the amount grows on paper but buys less and less.`,
    cashLoss: (lost) => `Left in a current account, the same money would lose ${lost} of buying power.`,
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
export function Simulation({ basis, ratePct, inflationPct }: { basis: AssetSimulation; ratePct?: number; inflationPct: number }) {
  const [startLei, setStart] = useState(5000);
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
        <p className="note">{t.inflationYours(pct(inflationPct, 2))}</p>
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
      <InflationTakes impact={impact} years={input.years} />
      <Bars impact={impact} realLabel={t.barHere} />
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
      <InflationTakes impact={impact} years={input.years} />
      <Bars impact={impact} realLabel={t.barTypical} />
      <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} typicalToday={todayMoney(r.typical, inflationPct)} />
      <div className="card card-accent" style={{ padding: 14, gap: 4 }}>
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

/** The headline: what inflation takes from the result, then paper vs today's money vs what you put in. */
function InflationTakes({ impact, years }: { impact: InflationImpact; years: number }) {
  const { t, lei, leiSigned, pct } = useSim();
  const beats = impact.realRatePct > 0;
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="card card-accent" style={{ padding: 16, gap: 6 }}>
        <span className="eyebrow">{t.eatsTitle(t.yearsN(years))}</span>
        <span className="money display-xl neg">{lei(impact.eatenLei)}</span>
        <p className="small">{t.eatsBody(lei(impact.nominalLei), lei(impact.realLei))}</p>
      </div>
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

/** Three bars on one scale, all in today's money: doing nothing, what you put in, this asset. */
function Bars({ impact, realLabel }: { impact: InflationImpact; realLabel: string }) {
  const { t, lei } = useSim();
  const rows = [
    { label: t.barCash, value: impact.cashRealLei, color: 'var(--accent-ink)' },
    { label: t.barPaid, value: impact.paidInRealLei, color: 'var(--line-strong)' },
    { label: realLabel, value: impact.realLei, color: impact.realLei >= impact.paidInRealLei ? 'var(--primary)' : 'var(--accent)' },
  ];
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure className="stack" style={{ margin: 0, gap: 8 }}>
      <figcaption className="eyebrow">{t.barsTitle}</figcaption>
      {rows.map((r) => (
        <div key={r.label} className="stack" style={{ gap: 3 }}>
          <div className="row small" style={{ justifyContent: 'space-between' }}>
            <span>{r.label}</span>
            <strong className="money">{lei(r.value)}</strong>
          </div>
          <div aria-hidden="true" style={{ height: 10, borderRadius: 5, background: 'var(--track)' }}>
            <div style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, height: '100%', borderRadius: 5, background: r.color }} />
          </div>
        </div>
      ))}
      <p className="note">{t.cashLoss(lei(Math.max(0, impact.paidInRealLei - impact.cashRealLei)))}</p>
    </figure>
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
