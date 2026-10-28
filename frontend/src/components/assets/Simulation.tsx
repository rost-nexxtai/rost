'use client';

import { useState } from 'react';
import { SimChart } from '@/components/ui/SimChart';
import { Slider } from '@/components/ui/Slider';
import { SourceLink } from '@/components/ui/SourceLink';
import { simulate, simulateRange, todayMoney } from '@/data/mock/simulation';
import type { AssetSimulation } from '@/data/types';
import { lei, pct } from '@/lib/format';

/** Sliders for start amount, monthly amount and years; the chart redraws as they move. */
export function Simulation({ basis, ratePct, inflationPct }: { basis: AssetSimulation; ratePct?: number; inflationPct: number }) {
  const [startLei, setStart] = useState(5000);
  const [monthlyLei, setMonthly] = useState(400);
  const [years, setYears] = useState(10);
  const input = { startLei, monthlyLei, years };

  return (
    <div className="stack-lg">
      {basis.kind === 'fixed' && ratePct !== undefined ? (
        <FixedResult input={input} ratePct={ratePct} inflationPct={inflationPct} />
      ) : basis.kind === 'range' ? (
        <RangeResult input={input} basis={basis} />
      ) : null}

      <div className="stack">
        <Slider label="Pornești cu" min={0} max={100000} step={500} value={startLei} onChange={setStart} format={lei} />
        <Slider label="Pui lunar" min={0} max={5000} step={50} value={monthlyLei} onChange={setMonthly} format={lei} />
        <Slider label="Timp de" min={1} max={40} step={1} value={years} onChange={setYears} format={(v) => (v === 1 ? '1 an' : `${v} ani`)} />
      </div>
    </div>
  );
}

type Input = { startLei: number; monthlyLei: number; years: number };

function FixedResult({ input, ratePct, inflationPct }: { input: Input; ratePct: number; inflationPct: number }) {
  const { value, paidIn } = simulate({ ...input, ratePct });
  const today = todayMoney(value, inflationPct);
  const end = (p: { valueLei: number }[]) => p.at(-1)?.valueLei ?? 0;
  return (
    <>
      <div className="stack" style={{ gap: 2 }}>
        <span className="small muted">Valoare după {input.years === 1 ? '1 an' : `${input.years} ani`}</span>
        <span className="money display-xl pos">{lei(end(value))}</span>
      </div>
      <div className="grid2">
        <Stat label="Ai depus" value={lei(end(paidIn))} />
        <Stat label={`În banii de azi (inflație ${pct(inflationPct, 2)})`} value={lei(end(today))} />
      </div>
      <SimChart kind="fixed" value={value} paidIn={paidIn} today={today} />
      <p className="note">
        La cea mai bună rată din listă, {pct(ratePct, 2)} pe an după impozit, presupunând că rămâne la fel. Rata se poate schimba în timp.
      </p>
    </>
  );
}

function RangeResult({ input, basis }: { input: Input; basis: Extract<AssetSimulation, { kind: 'range' }> }) {
  const r = simulateRange(input, basis);
  const end = (p: { valueLei: number }[]) => p.at(-1)?.valueLei ?? 0;
  return (
    <>
      <div className="stack" style={{ gap: 0 }}>
        <span className="small muted">După {input.years === 1 ? '1 an' : `${input.years} ani`}, dacă piața ar repeta un deceniu…</span>
        <RangeRow label="slab" value={lei(end(r.worst))} />
        <RangeRow label="tipic" value={lei(end(r.typical))} strong />
        <RangeRow label="bun" value={lei(end(r.best))} />
      </div>
      <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} />
      <div className="card card-accent" style={{ padding: 14, gap: 4 }}>
        <strong className="small">
          Un an ca {basis.worstYear.year}: {pct(basis.worstYear.pct, 1)}
        </strong>
        <p className="small">Pe termen scurt, valoarea poate scădea mult. Seriile de mai sus sunt istorice, nu o prognoză.</p>
      </div>
      {basis.note && <p className="small">{basis.note}</p>}
      <p className="note">
        Randamente anuale pe perioade de 10 ani, calculate de noi din <SourceLink label={basis.source.label} url={basis.source.url} />. În
        dolari, înainte de comisioane și taxe.
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
