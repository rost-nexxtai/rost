'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  { close: 'Închide lecția', step: (i: number, n: number) => `Pasul ${i} din ${n}` },
  { close: 'Close the lesson', step: (i, n) => `Step ${i} of ${n}` },
);

/**
 * The frame every lesson screen sits in: close, a segmented progress bar, then one idea per screen.
 * The step itself renders its LessonBar (the one button at the bottom).
 */
export function LessonShell({
  index,
  total,
  closeHref = '/momente',
  children,
}: {
  index: number;
  total: number;
  closeHref?: string;
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
      </header>
      <div className="lesson-body" key={index}>
        {children}
      </div>
    </main>
  );
}
