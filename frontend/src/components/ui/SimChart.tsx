import { lei } from '@/lib/format';
import type { Point } from '@/data/types';
import { compactLei, niceMax, scaleY } from './chart';

type Props =
  | { kind: 'fixed'; value: Point[]; paidIn: Point[]; today: Point[] }
  | { kind: 'range'; worst: Point[]; typical: Point[]; best: Point[] };

const W = 320;
const H = 180;
const PAD = { left: 40, right: 10, top: 10, bottom: 22 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

/** Line chart drawn as SVG. Fixed products: one line plus what you paid in; market assets: a worst-to-best band. */
export function SimChart(props: Props) {
  const series = props.kind === 'fixed' ? [props.value, props.paidIn, props.today] : [props.worst, props.typical, props.best];
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
      ? `După ${years} ani: ${lei(end(props.value))}. Ai depus ${lei(end(props.paidIn))}. În banii de azi: ${lei(end(props.today))}.`
      : `După ${years} ani: între ${lei(end(props.worst))} și ${lei(end(props.best))}, tipic ${lei(end(props.typical))}.`;

  return (
    <figure style={{ margin: 0 }} className="stack">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Grafic de simulare" style={{ display: 'block', overflow: 'visible' }}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(g) + 4} textAnchor="end" fontSize={10} fill="var(--muted)">
              {compactLei(g)}
            </text>
          </g>
        ))}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={H - 6} textAnchor={t === 0 ? 'start' : t === years ? 'end' : 'middle'} fontSize={10} fill="var(--muted)">
            {t === 0 ? 'azi' : `${t} ani`}
          </text>
        ))}

        {props.kind === 'fixed' ? (
          <>
            <path d={path(props.paidIn)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={path(props.today)} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
            <path d={path(props.value)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
          </>
        ) : (
          <>
            <path
              d={`${path(props.best)} ${[...props.worst].reverse().map((p) => `L${x(p.year).toFixed(1)},${y(p.valueLei).toFixed(1)}`).join(' ')} Z`}
              fill="var(--primary-tint)"
              stroke="none"
            />
            <path d={path(props.best)} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={1} />
            <path d={path(props.worst)} fill="none" stroke="var(--primary)" strokeOpacity={0.35} strokeWidth={1} />
            <path d={path(props.typical)} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinejoin="round" />
          </>
        )}
      </svg>
      <figcaption className="row-start small muted" style={{ flexWrap: 'wrap', gap: 14 }}>
        {props.kind === 'fixed' ? (
          <>
            <Legend color="var(--primary)" label="Valoare" />
            <Legend color="var(--muted)" label="Ai depus" dashed />
            <Legend color="var(--accent)" label="În banii de azi" />
          </>
        ) : (
          <>
            <Legend color="var(--primary)" label="Tipic" />
            <Legend color="var(--primary-tint)" label="Între cel mai slab și cel mai bun deceniu" block />
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
