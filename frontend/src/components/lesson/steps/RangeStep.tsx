'use client';

import { SimChart } from '@/components/ui/SimChart';
import { SourceLink } from '@/components/ui/SourceLink';
import { NATIONAL_INFLATION_PCT } from '@/data/mock/scoring';
import { simulateRange, todayMoney } from '@/data/mock/simulation';
import type { Asset } from '@/data/types';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';

/** What 1,000 lei did over 10 years in the worst, typical and best decade on record. */
export function RangeStep({ asset, onDone }: { asset: Asset; onDone: () => void }) {
  const { lang, f } = useLang();
  const t = LESSON[lang];
  if (asset.simulation.kind !== 'range') return null;
  const s = asset.simulation;
  const r = simulateRange({ startLei: 1000, monthlyLei: 0, years: 10 }, s);
  return (
    <>
      <span className="lesson-kicker">{t.fromHistory}</span>
      <h1 className="lesson-q">{t.tenYears(f.lei(1000))}</h1>
      <div className="play">
        <div className="grid3" style={{ textAlign: 'center' }}>
          <div>
            <div className="play-caption">{t.weakDecade}</div>
            <strong className="money">{f.lei(r.worst.at(-1)!.valueLei)}</strong>
          </div>
          <div>
            <div className="play-caption">{t.typical}</div>
            <strong className="money pos" style={{ fontSize: 20 }}>
              {f.lei(r.typical.at(-1)!.valueLei)}
            </strong>
          </div>
          <div>
            <div className="play-caption">{t.goodDecade}</div>
            <strong className="money">{f.lei(r.best.at(-1)!.valueLei)}</strong>
          </div>
        </div>
        <SimChart kind="range" worst={r.worst} typical={r.typical} best={r.best} typicalToday={todayMoney(r.typical, NATIONAL_INFLATION_PCT)} />
        <p className="note">
          {t.worstYear(s.worstYear.year, f.pct(s.worstYear.pct, 1))} <SourceLink label={s.source.label} url={s.source.url} />. {t.rangeNote}
        </p>
      </div>
      <LessonBar label={t.continue} onClick={onDone} />
    </>
  );
}
