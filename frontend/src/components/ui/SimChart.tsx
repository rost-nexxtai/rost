'use client';

import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { Point } from '@/data/types';
import { compactLei, niceMax, scaleY } from './chart';

/** today, cash and typicalToday are in today's money; cash is the same deposits left at 0%. */
type Props =
  | { kind: 'fixed'; value: Point[]; paidIn: Point[]; today: Point[]; cash: Point[] }
  | { kind: 'range'; worst: Point[]; typical: Point[]; best: Point[]; typicalToday: Point[] };

const T = copy(
  {
    fixed: (years: number, value: string, paid: string, today: string, cash: string) =>
      `După ${years} ani: ${value} pe hârtie, ${today} în banii de azi. Ai depus ${paid}; în cont curent ar fi valorat ${cash} în banii de azi.`,
    range: (years: number, worst: string, best: string, typical: string, today: string) =>
      `După ${years} ani: între ${worst} și ${best}, tipic ${typical}, adică ${today} în banii de azi.`,
    chart: 'Grafic de simulare',
    today: 'azi',
    years: (n: number) => `${n} ani`,
    value: 'Pe hârtie',
    paidIn: 'Ai depus',
    todayMoney: 'În banii de azi',
    eaten: 'Mâncat de inflație',
    cash: 'În cont curent, în banii de azi',
    typical: 'Tipic',
    typicalToday: 'Tipic, în banii de azi',
    band: 'Între cel mai slab și cel mai bun deceniu',
  },
  {
    fixed: (years, value, paid, today, cash) =>
      `After ${years} years: ${value} on paper, ${today} in today's money. You paid in ${paid}; in a current account it would be worth ${cash} in today's money.`,
    range: (years, worst, best, typical, today) => `After ${years} years: between ${worst} and ${best}, typically ${typical}, which is ${today} in today's money.`,
    chart: 'Simulation chart',
    today: 'now',
    years: (n) => `${n} yrs`,
    value: 'On paper',
    paidIn: 'You paid in',
    todayMoney: "In today's money",
    eaten: 'Eaten by inflation',
    cash: "In a current account, today's money",
    typical: 'Typical',
    typicalToday: "Typical, in today's money",
    band: 'Between the worst and the best decade',
  },
);

const W = 320;
const H = 180;
const PAD = { left: 40, right: 10, top: 10, bottom: 22 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/**
 * Line chart drawn as SVG. Fixed products: the paper value, the gap inflation eats down to today's
 * money (shaded), what you paid in, and cash at 0%. Market assets: a worst-to-best band with the
 * typical line, on paper and in today's money.
 */
export function SimChart(props: Props) {
  const { lang, f } = useLang();
  const t = T[lang];
  const lei = f.lei;
  const series = props.kind === 'fixed' ? [props.value, props.paidIn, props.today, props.cash] : [props.worst, props.typical, props.best, props.typicalToday];
  const years = Math.max(1, series[0].at(-1)?.year ?? 1);
  const max = niceMax(Math.max(0, ...series.flat().map((p) => p.valueLei).filter(Number.isFinite)));
  const x = (year: number) => PAD.left + (year / years) * PW;
  const y = (v: number) => PAD.top + scaleY(v, max, PH);
  const path = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)},${y(p.valueLei).toFixed(1)}`).join(' ');
  const grid = [0, max / 2, max];
  const ticks = Array.from(new Set([0, Math.round(years / 2), years]));

  const end = (pts: Point[]) => pts.at(-1)?.valueLei ?? 0;
  const summary =
    props.kind === 'fixed'
      ? t.fixed(years, lei(end(props.value)), lei(end(props.paidIn)), lei(end(props.today)), lei(end(props.cash)))
      : t.range(years, lei(end(props.worst)), lei(end(props.best)), lei(end(props.typical)), lei(end(props.typicalToday)));
  // the area between two lines: along `top`, back along `bottom`
  const between = (top: Point[], bottom: Point[]) =>
    `${path(top)} ${[...bottom].reverse().map((p) => `L${x(p.year).toFixed(1)},${y(p.valueLei).toFixed(1)}`).join(' ')} Z`;

  return (
    <figure style={{ margin: 0 }} className="stack">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t.chart} style={{ display: 'block', overflow: 'visible' }}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(g) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
              {compactLei(g, lang)}
            </text>
          </g>
        ))}
        {ticks.map((tick) => (
          <text key={tick} x={x(tick)} y={H - 6} textAnchor={tick === 0 ? 'start' : tick === years ? 'end' : 'middle'} fontSize={10} fill="var(--muted)">
            {tick === 0 ? t.today : t.years(tick)}
          </text>
        ))}

        {props.kind === 'fixed' ? (
          <>
            <path d={between(props.value, props.today)} fill="var(--accent-tint)" stroke="none" />
            <path d={path(props.paidIn)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={path(props.cash)} fill="none" stroke="var(--accent-ink)" strokeWidth={1.5} strokeDasharray="2 3" />
            <path d={path(props.value)} fill="none" stroke="var(--primary)" strokeWidth={2} strokeOpacity={0.6} strokeLinejoin="round" />
            <path d={path(props.today)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path d={between(props.best, props.worst)} fill="var(--primary-tint)" stroke="none" />
            <path d={path(props.best)} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={1} />
            <path d={path(props.worst)} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={1} />
            <path d={path(props.typical)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
            <path d={path(props.typicalToday)} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinejoin="round" />
          </>
        )}
      </svg>
      <figcaption className="row-start small muted" style={{ flexWrap: 'wrap', gap: 14 }}>
        {props.kind === 'fixed' ? (
          <>
            <Legend color="var(--primary)" label={t.value} />
            <Legend color="var(--accent)" label={t.todayMoney} />
            <Legend color="var(--accent-tint)" label={t.eaten} block />
            <Legend color="var(--muted)" label={t.paidIn} dashed />
            <Legend color="var(--accent-ink)" label={t.cash} dashed />
          </>
        ) : (
          <>
            <Legend color="var(--primary)" label={t.typical} />
            <Legend color="var(--accent)" label={t.typicalToday} />
            <Legend color="var(--primary-tint)" label={t.band} block />
          </>
        )}
      </figcaption>
      <p className="sr-only">{summary}</p>
    </figure>
  );
}

function Legend({ color, label, dashed, block }: { color: string; label: string; dashed?: boolean; block?: boolean }) {
  return (
    <span className="row-start" style={{ gap: 6 }}>
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: block ? 10 : 0,
          borderRadius: block ? 3 : 0,
          background: block ? color : undefined,
          borderTop: block ? undefined : `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        }}
      />
      {label}
    </span>
  );
}
