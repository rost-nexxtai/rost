'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { GAME } from '@/components/game/copy';
import { WeekStrip } from '@/components/game/WeekStrip';
import { Icon } from '@/components/ui/Icon';
import type { LessonReward, XpPart } from '@/data/mock/game';
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
    notYet: 'Aproape!',
    part: { answers: 'Răspunsuri', finish: 'Lecție terminată', perfect: 'Fără greșeală', combo: 'Combo' } as Record<XpPart['key'], string>,
    total: (n: number) => `${n} XP în total`,
    streakUp: (n: number): string => (n === 1 ? 'Ai început o serie. Revino mâine ca s-o ții.' : 'Seria crește. Revino mâine ca s-o ții.'),
    streakSame: 'Lecția de azi era deja bifată. Seria e în siguranță.',
    upNext: (title: string) => `Următoarea: ${title}`,
    retry: 'Mai încearcă lecția',
  },
  {
    notYet: 'Almost!',
    part: { answers: 'Answers', finish: 'Lesson finished', perfect: 'Flawless', combo: 'Combo' },
    total: (n) => `${n} XP in total`,
    streakUp: (n) => (n === 1 ? 'You started a streak. Come back tomorrow to keep it.' : 'Your streak grows. Come back tomorrow to keep it.'),
    streakSame: "Today's lesson was already ticked. Your streak is safe.",
    upNext: (title) => `Up next: ${title}`,
    retry: 'Try the lesson again',
  },
);

/** What saving the lesson came back with: a line about the level, passed or not, and the XP and streak won. */
export type FinishOutcome = { line: string; passed: boolean; reward?: LessonReward };

/** Counts up to `to` over a moment, so a reward is something you watch arrive. */
function useCountUp(to: number, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!to) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return setN(to);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n;
}

/**
 * The end of a lesson: a celebration, the XP counting up, the streak with this week's days, any new
 * badge, what to remember, and the next lesson one tap away. A failed lesson offers a retry instead.
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
  const g = GAME[lang];
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
  const reward = out?.reward;
  const xp = useCountUp(reward?.xp ?? 0);
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

        {reward && (
          <div className="reward-row">
            <section className="reward reward-xp" aria-label={`+${reward.xp} XP`}>
              <span className="reward-icon">
                <Icon name="bolt" size={22} />
              </span>
              <strong className="reward-big">+{xp} XP</strong>
              <ul className="xp-parts">
                {reward.parts.map((p) => (
                  <li key={p.key}>
                    <span>{f.part[p.key]}</span>
                    <span>+{p.xp}</span>
                  </li>
                ))}
              </ul>
              <span className="play-caption">{f.total(reward.totalXp)}</span>
            </section>
            <section className="reward reward-streak" data-up={reward.streakUp || undefined}>
              <span className="reward-icon">
                <Icon name="flame" size={22} />
              </span>
              <strong className="reward-big">{g.days(reward.streak)}</strong>
              <WeekStrip week={reward.week} letters={g.weekdays} />
              <span className="play-caption">{reward.streakUp ? f.streakUp(reward.streak) : f.streakSame}</span>
            </section>
          </div>
        )}

        {reward?.newBadges.map((b) => (
          <div key={b} className="badge-new">
            <span className="badge-medal">
              <Icon name="medal" size={26} />
            </span>
            <div style={{ textAlign: 'left' }}>
              <span className="eyebrow">{g.newBadge}</span>
              <strong style={{ display: 'block' }}>{g.badge[b].name}</strong>
              <span className="small muted">{g.badge[b].what}</span>
            </div>
          </div>
        ))}

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
      </div>
      {bar}
    </>
  );
}
