'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    close: 'Închide lecția',
    step: (i: number, n: number) => `Pasul ${i} din ${n}`,
    xp: (n: number) => `${n} XP în lecția asta`,
    combo: (n: number) => `${n} la rând`,
  },
  {
    close: 'Close the lesson',
    step: (i, n) => `Step ${i} of ${n}`,
    xp: (n) => `${n} XP in this lesson`,
    combo: (n) => `${n} in a row`,
  },
);

/** What one answer was: right first time, one sorting card right, right on the second try, or wrong. */
export type Hit = 'right' | 'card' | 'secondTry' | 'wrong';

/** XP just won and a key that changes every time, so the "+10" floats up again for the same amount. */
export type Gain = { xp: number; key: number };

/**
 * The frame every lesson screen sits in: close, a segmented progress bar, the XP won so far, then
 * one idea per screen. Right answers in a row light a combo. The step renders its own LessonBar.
 */
export function LessonShell({
  index,
  total,
  closeHref = '/momente',
  xp,
  gain,
  combo = 0,
  children,
}: {
  index: number;
  total: number;
  closeHref?: string;
  /** XP won in this lesson so far; no chip when left out. */
  xp?: number;
  gain?: Gain;
  /** Right answers in a row; shows from 2. */
  combo?: number;
  children: React.ReactNode;
}) {
  const t = T[useLang().lang];
  return (
    <main className="lesson">
      <header className="lesson-top">
        <Link href={closeHref} className="lesson-close" aria-label={t.close}>
          <Icon name="close" size={22} />
        </Link>
        <div className="segments" role="progressbar" aria-label={t.step(index + 1, total)} aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
          {Array.from({ length: total }, (_, i) => (
            <i key={i} data-on={i < index ? 'done' : i === index ? 'now' : undefined} />
          ))}
        </div>
        {xp !== undefined && (
          <span className="lesson-xp" aria-label={t.xp(xp)} data-hot={combo >= 3 || undefined}>
            <Icon name={combo >= 3 ? 'flame' : 'bolt'} size={18} />
            <span key={xp} className="lesson-xp-num">
              {xp}
            </span>
            {gain && (
              <span key={gain.key} className="xp-gain" aria-hidden="true">
                +{gain.xp}
              </span>
            )}
          </span>
        )}
      </header>
      {combo >= 2 && (
        <div className="combo" key={combo} role="status">
          <Icon name="flame" size={16} /> {t.combo(combo)}
        </div>
      )}
      <div className="lesson-body" key={index}>
        {children}
      </div>
    </main>
  );
}
