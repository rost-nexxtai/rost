'use client';

import { useState } from 'react';
import { Slider } from '@/components/ui/Slider';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { bondsVsDeposit, fundTarget, growth, LESSON_RATES, lossIfOneFails, monthsToGoal, netDepositPct, savingsVsDeposit } from './math';

export type WidgetId = 'fund_builder' | 'compound' | 'savings_vs_deposit' | 'diversify' | 'bonds_vs_deposit';

const T = copy(
  {
    months: (n: number) => (n === Infinity ? 'niciodată' : n === 1 ? 'o lună' : n < 20 ? `${n} luni` : `${n} de luni`),
    years: (n: number) => (n === 1 ? '1 an' : n < 20 ? `${n} ani` : `${n} de ani`),
    exampleRates: 'Dobânzi de exemplu.',
    // Emergency fund
    spend: 'Cheltui pe lună',
    howManyMonths: 'Câte luni acoperă',
    monthsTile: (m: number) => (m === 6 ? '6 luni (venit nesigur)' : `${m} luni`),
    target: 'Ținta ta',
    save: 'Pui deoparte lunar',
    afterYear: 'După un an ai',
    ofTarget: (have: string, target: string) => `${have} din ${target}`,
    reach: 'Ajungi la țintă în',
    already: (x: string) => `Ai deja cam ${x} puși deoparte, din ce ne-ai spus la început.`,
    reached: 'Ești deja la țintă. Bravo!',
    // Compound
    afterYears: (y: string) => `După ${y} ai`,
    split: (paid: string) => `tu ai pus ${paid}, dobânda a adus`,
    growthChart: (y: string) => `Creșterea în ${y}`,
    youPut: 'ce pui tu',
    interest: 'dobânda',
    monthly: 'Pui lunar',
    time: 'Timp',
    rate: 'Randament pe an',
    // Savings vs deposit
    needIn: 'Ai nevoie de bani peste',
    netOn: (amount: string) => `Câștigul net pe ${amount}, după impozit:`,
    savingsBar: (rate: string) => `Cont de economii · ${rate} brut`,
    depositBar: (rate: string) => `Depozit 12 luni · ${rate} brut`,
    breakEarly: ['Spargi depozitul înainte de termen, așa că ', 'pierzi dobânda', '. Contul de economii câștigă.'],
    keepYear: ['Ții banii tot anul, așa că ', 'depozitul câștigă', '.'],
    // Diversify
    howManyCompanies: 'Câte companii ai',
    eachDot: 'Fiecare punct e câte 7 companii.',
    oneFails: 'O companie dă faliment. Pierzi',
    ofMoney: (n: number, count: string) => (n === 1 ? 'din bani, dacă ai o singură companie' : `din bani, dacă ai ${count} de companii în părți egale`),
    // Bonds vs deposit
    put: 'Pui',
    depositHigh: (gross: string, net: string) => `Depozit ${gross} brut → ${net} net`,
    bond: (rate: string) => `Tezaur ${rate}, fără impozit`,
    bondWins: ['Într-un an, titlul de stat îți aduce cu ', ' mai mult, deși dobânda afișată e mai mică.'],
  },
  {
    months: (n) => (n === Infinity ? 'never' : n === 1 ? '1 month' : `${n} months`),
    years: (n) => (n === 1 ? '1 year' : `${n} years`),
    exampleRates: 'Example rates.',
    spend: 'You spend a month',
    howManyMonths: 'How many months it covers',
    monthsTile: (m) => (m === 6 ? '6 months (unsteady income)' : `${m} months`),
    target: 'Your target',
    save: 'You put aside monthly',
    afterYear: 'After a year you have',
    ofTarget: (have, target) => `${have} of ${target}`,
    reach: 'You reach it in',
    already: (x) => `You already have about ${x} saved, from what you told us at the start.`,
    reached: "You're already there. Well done!",
    afterYears: (y) => `After ${y} you have`,
    split: (paid) => `you put in ${paid}, interest added`,
    growthChart: (y) => `Growth over ${y}`,
    youPut: 'what you put in',
    interest: 'interest',
    monthly: 'Monthly',
    time: 'Time',
    rate: 'Return per year',
    needIn: 'You need the money in',
    netOn: (amount) => `Net gain on ${amount}, after tax:`,
    savingsBar: (rate) => `Savings account · ${rate} gross`,
    depositBar: (rate) => `12-month deposit · ${rate} gross`,
    breakEarly: ['You break the deposit early, so you ', 'lose the interest', '. The savings account wins.'],
    keepYear: ['You keep the money all year, so ', 'the deposit wins', '.'],
    howManyCompanies: 'How many companies you hold',
    eachDot: 'Each dot is 7 companies.',
    oneFails: 'One company goes bust. You lose',
    ofMoney: (n, count) => (n === 1 ? 'of your money, if you hold just one company' : `of your money, if you hold ${count} companies in equal parts`),
    put: 'You put in',
    depositHigh: (gross, net) => `Deposit ${gross} gross → ${net} net`,
    bond: (rate) => `Tezaur ${rate}, tax-free`,
    bondWins: ['In a year, the state bond earns you ', ' more, even though its headline rate is lower.'],
  },
);

/** Wraps a setter so the first change tells the step the user has played with it. */
function useTouch(onTouch: () => void) {
  const [touched, setTouched] = useState(false);
  return <V,>(set: (v: V) => void) =>
    (v: V) => {
      set(v);
      if (!touched) {
        setTouched(true);
        onTouch();
      }
    };
}

function useWidget() {
  const { lang, f } = useLang();
  return { t: T[lang], f, lang };
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

/**
 * Emergency fund: your expenses set the target, your monthly saving sets how long it takes.
 * Starts from the months you said you already have saved at onboarding.
 */
function FundBuilder({ onTouch, haveMonths = 0 }: { onTouch: () => void; haveMonths?: number }) {
  const { t, f } = useWidget();
  const touch = useTouch(onTouch);
  const [spend, setSpend] = useState(2500);
  const [span, setSpan] = useState(3);
  const [save, setSave] = useState(300);
  const target = fundTarget(spend, span);
  const have = Math.min(target, fundTarget(spend, haveMonths));
  const n = monthsToGoal(target, save, have);
  const afterYear = Math.min(target, have + save * 12);
  const firstYear = target > 0 ? afterYear / target : 1;
  return (
    <div className="play">
      <Slider label={t.spend} min={1000} max={8000} step={100} value={spend} onChange={touch(setSpend)} format={f.lei} />
      <div className="tiles-row" role="group" aria-label={t.howManyMonths}>
        {[3, 6].map((m) => (
          <button key={m} type="button" className="tile" aria-pressed={span === m} onClick={() => touch(setSpan)(m)}>
            {t.monthsTile(m)}
          </button>
        ))}
      </div>
      <div>
        <div className="play-caption">{t.target}</div>
        <div className="play-big pos">{f.lei(target)}</div>
      </div>
      <Slider label={t.save} min={100} max={2000} step={50} value={save} onChange={touch(setSave)} format={f.lei} />
      {have > 0 && <p className="note">{t.already(f.lei(have))}</p>}
      <Bar label={t.afterYear} value={firstYear} max={1} color="var(--primary)" right={t.ofTarget(f.lei(afterYear), f.lei(target))} />
      <p className="lesson-text">
        {n === 0 ? (
          t.reached
        ) : (
          <>
            {t.reach} <strong>{t.months(n)}</strong>.
          </>
        )}
      </p>
    </div>
  );
}

/** Saving every month, compounded: the bars split what you put in from what the interest added. */
function Compound({ onTouch }: { onTouch: () => void }) {
  const { t, f } = useWidget();
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
        <div className="play-caption">{t.afterYears(t.years(years))}</div>
        <div className="play-big pos">{f.lei(last.value)}</div>
        <div className="play-caption">
          {t.split(f.lei(last.paidIn))} <strong className="pos">{f.lei(last.value - last.paidIn)}</strong>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={t.growthChart(t.years(years))} style={{ width: '100%', height: 'auto' }}>
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
          <span className="swatch" style={{ background: 'var(--line-strong)' }} /> {t.youPut}
        </span>
        <span className="row-start" style={{ gap: 6 }}>
          <span className="swatch" style={{ background: 'var(--primary)' }} /> {t.interest}
        </span>
      </div>
      <Slider label={t.monthly} min={50} max={1000} step={50} value={monthly} onChange={touch(setMonthly)} format={f.lei} />
      <Slider label={t.time} min={1} max={40} step={1} value={years} onChange={touch(setYears)} format={t.years} />
      <Slider label={t.rate} min={0} max={10} step={0.5} value={rate} onChange={touch(setRate)} format={(v) => f.pct(v, 1)} />
    </div>
  );
}

/** When you need the money decides between a savings account and a 12-month deposit. */
function SavingsVsDeposit({ onTouch }: { onTouch: () => void }) {
  const { t, f } = useWidget();
  const touch = useTouch(onTouch);
  const [m, setM] = useState(6);
  const amount = 10_000;
  const r = savingsVsDeposit(amount, m);
  const max = Math.max(r.savings, r.deposit, 1);
  const [before, bold, after] = m < 12 ? t.breakEarly : t.keepYear;
  return (
    <div className="play">
      <Slider label={t.needIn} min={1} max={12} step={1} value={m} onChange={touch(setM)} format={t.months} />
      <p className="play-caption">{t.netOn(f.lei(amount))}</p>
      <Bar label={t.savingsBar(f.pct(LESSON_RATES.savingsPct))} value={r.savings} max={max} color="var(--primary)" right={f.lei(r.savings)} />
      <Bar label={t.depositBar(f.pct(LESSON_RATES.deposit12Pct, 2))} value={r.deposit} max={max} color="var(--accent)" right={f.lei(r.deposit)} />
      <p className="lesson-text">
        {before}
        <strong>{bold}</strong>
        {after}
      </p>
      <p className="note">{t.exampleRates}</p>
    </div>
  );
}

const BASKETS = [1, 10, 100, 1400] as const;

/** One company goes bust: how much of your money goes with it depends on how many you hold. */
function Diversify({ onTouch }: { onTouch: () => void }) {
  const { t, f } = useWidget();
  const touch = useTouch(onTouch);
  const [n, setN] = useState<(typeof BASKETS)[number]>(1);
  const dots = n === 1400 ? 200 : n;
  return (
    <div className="play">
      <div className="tiles-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} role="group" aria-label={t.howManyCompanies}>
        {BASKETS.map((b) => (
          <button key={b} type="button" className="tile" style={{ minHeight: 52, padding: 8 }} aria-pressed={n === b} onClick={() => touch(setN)(b)}>
            {f.num(b)}
          </button>
        ))}
      </div>
      <div className="dotgrid" style={n < 20 ? { gridTemplateColumns: `repeat(${Math.max(n, 5)}, 1fr)`, maxWidth: n === 1 ? 64 : undefined } : undefined} aria-hidden="true">
        {Array.from({ length: dots }, (_, i) => (
          <i key={i} data-bust={i === 0 ? '' : undefined} />
        ))}
      </div>
      {n === 1400 && <p className="note">{t.eachDot}</p>}
      <div>
        <div className="play-caption">{t.oneFails}</div>
        <div className="play-big neg">{f.pct(lossIfOneFails(n), n === 1400 ? 2 : 0)}</div>
        <div className="play-caption">{t.ofMoney(n, f.num(n))}</div>
      </div>
    </div>
  );
}

/** A taxed deposit with a higher headline rate against a tax-free state bond. */
function BondsVsDeposit({ onTouch }: { onTouch: () => void }) {
  const { t, f } = useWidget();
  const touch = useTouch(onTouch);
  const [amount, setAmount] = useState(10_000);
  const r = bondsVsDeposit(amount);
  const max = Math.max(r.deposit, r.bond, 1);
  return (
    <div className="play">
      <Slider label={t.put} min={1000} max={50_000} step={1000} value={amount} onChange={touch(setAmount)} format={f.lei} />
      <Bar label={t.depositHigh(f.pct(LESSON_RATES.depositHighPct, 0), f.pct(netDepositPct(LESSON_RATES.depositHighPct)))} value={r.deposit} max={max} color="var(--accent)" right={f.lei(r.deposit)} />
      <Bar label={t.bond(f.pct(LESSON_RATES.bondPct))} value={r.bond} max={max} color="var(--primary)" right={f.lei(r.bond)} />
      <p className="lesson-text">
        {t.bondWins[0]}
        <strong className="pos">{f.lei(r.bond - r.deposit)}</strong>
        {t.bondWins[1]}
      </p>
      <p className="note">{t.exampleRates}</p>
    </div>
  );
}

export function Widget({ id, onTouch, haveMonths }: { id: WidgetId; onTouch: () => void; haveMonths?: number }) {
  switch (id) {
    case 'fund_builder':
      return <FundBuilder onTouch={onTouch} haveMonths={haveMonths} />;
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
