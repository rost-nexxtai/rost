'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { WeekDots } from '@/components/ui/WeekDots';
import type { WeekDay } from '@/data/mock/rhythm';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';

const COLORS = ['var(--primary)', 'var(--accent)', '#d4a53a', 'var(--ink)'];
// Fixed spread so server and client render the same pieces.
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = 70 + (i % 4) * 22;
  return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d - 30), r: (i * 47) % 360, c: COLORS[i % 4], delay: (i % 5) * 40 };
});

const T = copy(
  {
    notYet: 'Aproape',
    upNext: (title: string) => `Următoarea: ${title}`,
    retry: 'Reia lecția',
  },
  {
    notYet: 'Almost',
    upNext: (title) => `Up next: ${title}`,
    retry: 'Take the lesson again',
  },
);

/** What saving the lesson came back with: a line about the level, passed or not, and this week. */
export type FinishOutcome = { line: string; passed: boolean; week?: WeekDay[] };

/**
 * The end of a lesson: the score, what to remember, this week at a glance, and the next lesson one
 * tap away. A failed lesson offers to take it again instead.
 */
export function FinishStep({
  title,
  takeaways,
  right,
  graded,
  seconds,
  cta,
  upNext,
  onFinish,
  onRetry,
}: {
  title: string;
  takeaways: string[];
  right: number;
  graded: number;
  seconds: number;
  cta: { label: string; href: string };
  upNext?: { id: string; title: string; minutes: number };
  /** Saves progress and says how it went. */
  onFinish: () => Promise<FinishOutcome>;
  /** Starts a failed lesson over; without it a failed lesson just goes back to Momente. */
  onRetry?: () => void;
}) {
  const router = useRouter();
  const { lang } = useLang();
  const t = LESSON[lang];
  const f = T[lang];
  const [out, setOut] = useState<FinishOutcome>();
  // The completion is saved while this screen shows. Leaving waits for it, so a quick tap on the
  // button never leaves the lesson unmarked.
  const saved = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    saved.current = onFinish()
      .then(setOut)
      .catch(() => setOut({ line: '', passed: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const go = (href: string) => {
    void saved.current.then(() => router.push(href));
  };
  const minutes = Math.max(1, Math.round(seconds / 60));
  const failed = out?.passed === false;

  const bar = failed && onRetry ? (
    <LessonBar label={f.retry} onClick={onRetry} secondary={{ label: t.backToMoments, onClick: () => go('/momente') }} />
  ) : upNext ? (
    <LessonBar label={f.upNext(upNext.title)} onClick={() => go(`/moment/lib/${upNext.id}`)} secondary={{ label: cta.label, onClick: () => go(cta.href) }} />
  ) : (
    <LessonBar label={cta.label} onClick={() => go(cta.href)} secondary={cta.href !== '/momente' ? { label: t.backToMoments, onClick: () => go('/momente') } : undefined} />
  );

  return (
    <>
      <div className="celebrate">
        {out && !failed && (
          <div className="confetti" aria-hidden="true">
            {PIECES.map((p, i) => (
              <i
                key={i}
                style={{ background: p.c, animationDelay: `${p.delay}ms`, ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--r' as string]: `${p.r}deg` }}
              />
            ))}
          </div>
        )}
        <div className="celebrate-badge" data-tone={failed ? 'wrong' : undefined}>
          <Icon name={failed ? 'redo' : 'check'} size={48} />
        </div>
        <h1 className="lesson-q">{failed ? f.notYet : t.done(title)}</h1>
        <p className="muted" aria-live="polite">
          {out ? out.line : t.savingProgress}
        </p>
        <div className="score-row" style={graded < 2 ? { gridTemplateColumns: '1fr' } : undefined}>
          {graded >= 2 && (
            <div className="score">
              <span className="play-caption">{t.rightAnswers}</span>
              <strong>
                {right}/{graded}
              </strong>
            </div>
          )}
          <div className="score">
            <span className="play-caption">{t.time}</span>
            <strong>{t.minutes(minutes)}</strong>
          </div>
        </div>
        {takeaways.length > 0 && !failed && (
          <div className="play" style={{ width: '100%' }}>
            <strong>{t.remember}</strong>
            <ul className="takeaways" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        {out?.week && (
          <div className="play" style={{ width: '100%' }}>
            <WeekDots week={out.week} lang={lang} />
          </div>
        )}
      </div>
      {bar}
    </>
  );
}
