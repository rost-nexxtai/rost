'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';

/**
 * Sorting, one card at a time: tap the bucket it belongs in, see right or wrong at once.
 * A right tap moves on by itself; a wrong one stays, says why, and waits for Continuă.
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
  const finished = answers.length === items.length;
  const item = items[Math.min(i, items.length - 1)];
  const right = answers.filter(Boolean).length;
  const t = LESSON[useLang().lang];

  const next = () => {
    setFlash(undefined);
    setI((n) => n + 1);
  };

  useEffect(() => {
    if (flash !== 'correct') return;
    const timer = setTimeout(next, 450);
    return () => clearTimeout(timer);
  }, [flash]);

  function pick(bucket: 0 | 1) {
    if (flash || finished) return;
    const ok = bucket === item.bucket;
    setAnswers((a) => [...a, ok]);
    setFlash(ok ? 'correct' : 'wrong');
  }

  return (
    <>
      <span className="lesson-kicker">{t.sort}</span>
      <h1 className="lesson-q">{question}</h1>
      <div className="sort-dots" aria-hidden="true">
        {items.map((_, n) => (
          <i key={n} data-state={n < answers.length ? (answers[n] ? 'correct' : 'wrong') : undefined} />
        ))}
      </div>
      {!finished || flash ? (
        <>
          <div className="sort-card" key={i} data-state={flash} aria-live="polite">
            {item.label}
          </div>
          {flash === 'wrong' ? (
            <LessonBar tone="wrong" title={t.goesTo(buckets[item.bucket])} body={item.why} label={t.continue} onClick={next} />
          ) : (
            <>
              <p className="sort-count">{t.nOfM(Math.min(i + 1, items.length), items.length)}</p>
              <div className="tiles-row">
                {buckets.map((b, n) => (
                  <button key={b} type="button" className="tile" disabled={!!flash} onClick={() => pick(n as 0 | 1)}>
                    {b}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="play" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="play-big">
            {t.nOfM(right, items.length)}
          </div>
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
