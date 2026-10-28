import { SimChart } from '@/components/ui/SimChart';
import { SourceLink } from '@/components/ui/SourceLink';
import { simulateRange } from '@/data/mock/simulation';
import type { Asset } from '@/data/types';
import { lei, pct } from '@/lib/format';
import { LessonBar } from '../LessonBar';

/** What 1,000 lei did over 10 years in the worst, typical and best decade on record. */
export function RangeStep({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  if (asset.simulation.kind !== 'range') return null;
  const s = asset.simulation;
  const r = simulateRange({ startLei: 1000, monthlyLei: 0, years: 10 }, s);
  return (
    <>
      <span className="lesson-kicker">Din istorie</span>
      <h1 className="lesson-q">1.000 lei lăsați 10 ani</h1>
      <div className="play">
        <div className="grid3" style={{ textAlign: 'center' }}>
          <div>
            <div className="play-caption">deceniu slab</div>
            <strong className="money">{lei(r.worst.at(-1)!.valueLei)}</strong>
          </div>
          <div>
            <div className="play-caption">tipic</div>
            <strong className="money pos" style={{ fontSize: 20 }}>
              {lei(r.typical.at(-1)!.valueLei)}
            </strong>
          </div>
          <div>
            <div className="play-caption">deceniu bun</div>
            <strong className="money">{lei(r.best.at(-1)!.valueLei)}</strong>
          </div>
        </div>
        <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} />
        <p className="note">
          Cel mai rău an: {s.worstYear.year}, {pct(s.worstYear.pct, 1)}. Sursa: <SourceLink label={s.source.label} url={s.source.url} />. În dolari,
          înainte de comisioane și taxe. Trecutul nu e o promisiune.
        </p>
      </div>
      <LessonBar label="Continuă" onClick={onDone} />
    </>
  );
}
