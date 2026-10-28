'use client';

import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import { feel } from '../feel';

/** How far (px) a card has to be swiped to count as an answer. */
const SWIPE = 80;

/**
 * Sorting, one card at a time: swipe it left or right, or tap the bucket, and see right or wrong at
 * once. A right card flies off and the next one comes; a wrong one stays, says why, and waits.
 */
export function SortStep({
  question,
  buckets,
  items,
  explain,
  onDone,
}: {
  question: string;
  buckets: [string, string];
  items: { label: string; bucket: 0 | 1; why?: string }[];
  explain: string;
  onDone: (correct: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [flash, setFlash] = useState<'correct' | 'wrong'>();
  const [fly, setFly] = useState<0 | 1>();
  const [dx, setDx] = useState(0);
  const from = useRef<number | null>(null);
  const finished = answers.length === items.length;
  const item = items[Math.min(i, items.length - 1)];
  const right = answers.filter(Boolean).length;
  const t = LESSON[useLang().lang];

  const next = () => {
    setFlash(undefined);
    setFly(undefined);
    setI((n) => n + 1);
  };

  useEffect(() => {
    if (flash !== 'correct') return;
    const timer = setTimeout(next, 420);
    return () => clearTimeout(timer);
  }, [flash]);

  function pick(bucket: 0 | 1) {
    if (flash || finished) return;
    const ok = bucket === item.bucket;
    setDx(0);
    setAnswers((a) => [...a, ok]);
    setFlash(ok ? 'correct' : 'wrong');
    if (ok) setFly(bucket);
    feel(ok ? 'right' : 'wrong');
  }

  const lean = dx < -24 ? 0 : dx > 24 ? 1 : undefined;
  const drag = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (flash) return;
      from.current = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (from.current !== null) setDx(e.clientX - from.current);
    },
    onPointerUp: () => {
      if (from.current === null) return;
      from.current = null;
      if (Math.abs(dx) >= SWIPE) pick(dx < 0 ? 0 : 1);
      else setDx(0);
    },
    onPointerCancel: () => {
      from.current = null;
      setDx(0);
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') pick(0);
      if (e.key === 'ArrowRight') pick(1);
    },
  };

  return (
    <>
      <span className="lesson-kicker">{t.sort}</span>
      <h1 className="lesson-q">{question}</h1>
      <div className="sort-dots" aria-hidden="true">
        {items.map((_, n) => (
          <i key={n} data-state={n < answers.length ? (answers[n] ? 'correct' : 'wrong') : n === i ? 'now' : undefined} />
        ))}
      </div>
      {!finished || flash ? (
        <>
          <div className="sort-stage">
            {i + 1 < items.length && <div className="sort-under" aria-hidden="true" />}
            <div
              className="sort-card"
              key={i}
              data-state={flash}
              data-fly={fly}
              data-dragging={dx !== 0 || undefined}
              aria-live="polite"
              tabIndex={0}
              style={dx ? { transform: `translateX(${dx}px) rotate(${dx / 18}deg)` } : undefined}
              {...drag}
            >
              {item.label}
            </div>
          </div>
          {flash === 'wrong' ? (
            <LessonBar tone="wrong" title={t.goesTo(buckets[item.bucket])} body={item.why} label={t.continue} onClick={next} />
          ) : (
            <>
              <p className="sort-count">
                {t.nOfM(Math.min(i + 1, items.length), items.length)} · {t.swipeHint}
              </p>
              <div className="tiles-row">
                {buckets.map((b, n) => (
                  <button key={b} type="button" className="tile" data-lean={lean === n || undefined} disabled={!!flash} onClick={() => pick(n as 0 | 1)}>
                    {n === 0 ? '← ' : ''}
                    {b}
                    {n === 1 ? ' →' : ''}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="play" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="play-big">{t.nOfM(right, items.length)}</div>
          <p className="play-caption">{t.firstTime}</p>
        </div>
      )}
      {finished && !flash && (
        <LessonBar
          tone={right === items.length ? 'correct' : 'wrong'}
          title={right === items.length ? t.allRight : t.almost}
          body={explain}
          label={t.continue}
          onClick={() => onDone(right === items.length)}
        />
      )}
    </>
  );
}
