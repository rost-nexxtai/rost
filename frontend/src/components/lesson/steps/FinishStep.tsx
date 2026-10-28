'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';

const COLORS = ['var(--primary)', 'var(--accent)', '#d4a53a', 'var(--ink)'];
// Fixed spread so server and client render the same pieces.
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const d = 70 + (i % 4) * 22;
  return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d - 30), r: (i * 47) % 360, c: COLORS[i % 4], delay: (i % 5) * 40 };
});

/** The end of a lesson: a small celebration, the score, what to remember, and one next step. */
export function FinishStep({
  title,
  takeaways,
  right,
  graded,
  seconds,
  cta,
  onFinish,
}: {
  title: string;
  takeaways: string[];
  right: number;
  graded: number;
  seconds: number;
  cta: { label: string; href: string };
  /** Saves progress and returns a line about the level, e.g. "Încă 2 lecții până la L1". */
  onFinish: () => Promise<string>;
}) {
  const router = useRouter();
  const t = LESSON[useLang().lang];
  const [line, setLine] = useState<string>();
  useEffect(() => {
    onFinish().then(setLine).catch(() => setLine(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const minutes = Math.max(1, Math.round(seconds / 60));

  return (
    <>
      <div className="celebrate">
        <div className="confetti" aria-hidden="true">
          {PIECES.map((p, i) => (
            <i
              key={i}
              style={{ background: p.c, animationDelay: `${p.delay}ms`, ['--x' as string]: `${p.x}px`, ['--y' as string]: `${p.y}px`, ['--r' as string]: `${p.r}deg` }}
            />
          ))}
        </div>
        <div className="celebrate-badge">
          <Icon name="check" size={48} />
        </div>
        <h1 className="lesson-q">{t.done(title)}</h1>
        <p className="muted" aria-live="polite">
          {line ?? t.savingProgress}
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
        {takeaways.length > 0 && (
          <div className="play" style={{ width: '100%' }}>
            <strong>{t.remember}</strong>
            <ul className="takeaways" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        )}
        <Link href="/momente" className="small">
          {t.backToMoments}
        </Link>
      </div>
      <LessonBar label={cta.label} onClick={() => router.push(cta.href)} />
    </>
  );
}
