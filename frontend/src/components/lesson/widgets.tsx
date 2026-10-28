'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/Slider';
import { lei, pct } from '@/lib/format';
import { bondsVsDeposit, fundTarget, growth, LESSON_RATES, lossIfOneFails, monthsToGoal, netDepositPct, savingsVsDeposit } from './math';

export type WidgetId = 'fund_builder' | 'compound' | 'savings_vs_deposit' | 'diversify' | 'bonds_vs_deposit';

const months = (n: number) => (n === Infinity ? 'niciodată' : n === 1 ? 'o lună' : n < 20 ? `${n} luni` : `${n} de luni`);

/** Wraps a setter so the first change tells the step the user has played with it. */
function useTouch(onTouch: () => void) {
  const [touched, setTouched] = useState(false);
  return <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      if (!touched) {
        setTouched(true);
        onTouch();
      }
    };
}

function Bar({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right: string }) {
  return (
    <div className="hbar">
      <div className="row small">
        <span>{label}</span>
        <strong className="money">{right}</strong>
      </div>
      <div className="hbar-track">
        <div style={{ width: `${max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0}%`, background: color }} />
      </div>
    </div>
  );
}

/** Emergency fund: your expenses set the target, your monthly saving sets how long it takes. */
function FundBuilder({ onTouch }: { onTouch: () => void }) {
  const touch = useTouch(onTouch);
  const [spend, setSpend] = useState(2500);
  const [span, setSpan] = useState(3);
  const [save, setSave] = useState(300);
  const target = fundTarget(spend, span);
  const n = monthsToGoal(target, save);
  const firstYear = Math.min(1, (save * 12) / target);
  return (
    <div className="play">
      <Slider label="Cheltui pe lună" min={1000} max={8000} step={100} value={spend} onChange={touch(setSpend)} format={lei} />
      <div className="tiles-row" role="group" aria-label="Câte luni acoperă">
        {[3, 6].map((m) => (
          <button key={m} type="button" className="tile" aria-pressed={span === m} onClick={() => touch(setSpan)(m)}>
            {m} luni {m === 6 ? '(venit nesigur)' : ''}
          </button>
        ))}
      </div>
      <div>
        <div className="play-caption">Ținta ta</div>
        <div className="play-big pos">{lei(target)}</div>
      </div>
      <Slider label="Pui deoparte lunar" min={100} max={2000} step={50} value={save} onChange={touch(setSave)} format={lei} />
      <Bar label="După un an ai" value={firstYear} max={1} color="var(--primary)" right={`${lei(Math.min(target, save * 12))} din ${lei(target)}`} />
      <p className="lesson-text">
        Ajungi la țintă în <strong>{months(n)}</strong>.
      </p>
    </div>
  );
}

/** Saving every month, compounded: the bars split what you put in from what the interest added. */
function Compound({ onTouch }: { onTouch: () => void }) {
  const touch = useTouch(onTouch);
  const [monthly, setMonthly] = useState(200);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(6);
  const series = growth(monthly, rate, years);
  const last = series[series.length - 1];
  const max = Math.max(1, last.value);
  const w = 300;
  const h = 120;
  const bw = w / series.length;
  return (
    <div className="play">
      <div>
        <div className="play-caption">După {years} ani ai</div>
        <div className="play-big pos">{lei(last.value)}</div>
        <div className="play-caption">
          tu ai pus {lei(last.paidIn)}, dobânda a adus <strong className="pos">{lei(last.value - last.paidIn)}</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Creșterea pe ${years} ani`} style={{ width: '100%', height: 'auto' }}>
        {series.map((p, i) => {
          const paid = (p.paidIn / max) * h;
          const all = (p.value / max) * h;
          return (
            <g key={p.year}>
              <rect x={i * bw + bw * 0.12} y={h - all} width={bw * 0.76} height={Math.max(0, all - paid)} rx={1.5} fill="var(--primary)" />
              <rect x={i * bw + bw * 0.12} y={h - paid} width={bw * 0.76} height={paid} rx={1.5} fill="var(--line-strong)" />
            </g>
          );
        })}
      </svg>
      <div className="row small muted" style={{ justifyContent: 'flex-start', gap: 14 }}>
        <span className="row-start" style={{ gap: 6 }}>
          <span className="swatch" style={{ background: 'var(--line-strong)' }} /> ce pui tu
        </span>
        <span className="row-start" style={{ gap: 6 }}>
          <span className="swatch" style={{ background: 'var(--primary)' }} /> dobânda
        </span>
      </div>
      <Slider label="Pui lunar" min={50} max={1000} step={50} value={monthly} onChange={touch(setMonthly)} format={lei} />
      <Slider label="Timp" min={1} max={40} step={1} value={years} onChange={touch(setYears)} format={(v) => (v === 1 ? '1 an' : v < 20 ? `${v} ani` : `${v} de ani`)} />
      <Slider label="Randament pe an" min={0} max={10} step={0.5} value={rate} onChange={touch(setRate)} format={(v) => pct(v, 1)} />
    </div>
  );
}

/** When you need the money decides between a savings account and a 12-month deposit. */
function SavingsVsDeposit({ onTouch }: { onTouch: () => void }) {
  const touch = useTouch(onTouch);
  const [m, setM] = useState(6);
  const amount = 10_000;
  const r = savingsVsDeposit(amount, m);
  const max = Math.max(r.savings, r.deposit, 1);
  return (
    <div className="play">
      <Slider label="Ai nevoie de bani peste" min={1} max={12} step={1} value={m} onChange={touch(setM)} format={(v) => months(v)} />
      <p className="play-caption">Câștigul net pe {lei(amount)}, după impozit:</p>
      <Bar label={`Cont de economii · ${pct(LESSON_RATES.savingsPct)} brut`} value={r.savings} max={max} color="var(--primary)" right={lei(r.savings)} />
      <Bar label={`Depozit 12 luni · ${pct(LESSON_RATES.deposit12Pct, 2)} brut`} value={r.deposit} max={max} color="var(--accent)" right={lei(r.deposit)} />
      <p className="lesson-text">
        {m < 12 ? (
          <>
            Spargi depozitul înainte de termen, așa că <strong>pierzi dobânda</strong>. Contul de economii câștigă.
          </>
        ) : (
          <>
            Ții banii tot anul, așa că <strong>depozitul câștigă</strong>.
          </>
        )}
      </p>
      <p className="note">Dobânzi de exemplu.</p>
    </div>
  );
}

const BASKETS = [1, 10, 100, 1400] as const;

/** One company goes bust: how much of your money goes with it depends on how many you hold. */
function Diversify({ onTouch }: { onTouch: () => void }) {
  const touch = useTouch(onTouch);
  const [n, setN] = useState<(typeof BASKETS)[number]>(1);
  const dots = n === 1400 ? 200 : n;
  return (
    <div className="play">
      <div className="tiles-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} role="group" aria-label="Câte companii ai">
        {BASKETS.map((b) => (
          <button key={b} type="button" className="tile" style={{ minHeight: 52, padding: 8 }} aria-pressed={n === b} onClick={() => touch(setN)(b)}>
            {b.toLocaleString('ro-RO')}
          </button>
        ))}
      </div>
      <div className="dotgrid" style={n < 20 ? { gridTemplateColumns: `repeat(${Math.max(n, 5)}, 1fr)`, maxWidth: n === 1 ? 64 : undefined } : undefined} aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => (
          <i key={i} data-bust={i === 0 ? '' : undefined} />
        ))}
      </div>
      {n === 1400 && <p className="note">Fiecare punct e câte 7 companii.</p>}
      <div>
        <div className="play-caption">O companie dă faliment. Pierzi</div>
        <div className="play-big neg">{pct(lossIfOneFails(n), n === 1400 ? 2 : 0)}</div>
        <div className="play-caption">din bani, dacă ai {n === 1 ? 'o singură companie' : `${n.toLocaleString('ro-RO')} de companii în părți egale`}</div>
      </div>
    </div>
  );
}

/** A taxed deposit with a higher headline rate against a tax-free state bond. */
function BondsVsDeposit({ onTouch }: { onTouch: () => void }) {
  const touch = useTouch(onTouch);
  const [amount, setAmount] = useState(10_000);
  const r = bondsVsDeposit(amount);
  const max = Math.max(r.deposit, r.bond, 1);
  return (
    <div className="play">
      <Slider label="Pui" min={1000} max={50_000} step={1000} value={amount} onChange={touch(setAmount)} format={lei} />
      <Bar label={`Depozit ${pct(LESSON_RATES.depositHighPct, 0)} brut → ${pct(netDepositPct(LESSON_RATES.depositHighPct))} net`} value={r.deposit} max={max} color="var(--accent)" right={lei(r.deposit)} />
      <Bar label={`Tezaur ${pct(LESSON_RATES.bondPct)}, fără impozit`} value={r.bond} max={max} color="var(--primary)" right={lei(r.bond)} />
      <p className="lesson-text">
        Într-un an, titlul de stat îți aduce cu <strong className="pos">{lei(r.bond - r.deposit)}</strong> mai mult, deși dobânda afișată e mai mică.
      </p>
      <p className="note">Dobânzi de exemplu.</p>
    </div>
  );
}

export function Widget({ id, onTouch }: { id: WidgetId; onTouch: () => void }) {
  switch (id) {
    case 'fund_builder':
      return <FundBuilder onTouch={onTouch} />;
    case 'compound':
      return <Compound onTouch={onTouch} />;
    case 'savings_vs_deposit':
      return <SavingsVsDeposit onTouch={onTouch} />;
    case 'diversify':
      return <Diversify onTouch={onTouch} />;
    case 'bonds_vs_deposit':
      return <BondsVsDeposit onTouch={onTouch} />;
  }
}
