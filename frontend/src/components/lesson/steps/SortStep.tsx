'use client';

import { useEffect, useState } from 'react';
import { LessonBar } from '../LessonBar';

/**
 * Sorting, one card at a time: tap the bucket it belongs in, see right or wrong at once, next card.
 * Short and rhythmic on purpose; the reason comes once, at the end.
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
  items: { label: string; bucket: 0 | 1 }[];
  explain: string;
  onDone: (correct: boolean) => void;
}) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [flash, setFlash] = useState<'correct' | 'wrong'>();
  const finished = answers.length === items.length;
  const item = items[Math.min(i, items.length - 1)];
  const right = answers.filter(Boolean).length;

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => {
      setFlash(undefined);
      setI((n) => n + 1);
    }, flash === 'correct' ? 450 : 900);
    return () => clearTimeout(t);
  }, [flash]);

  function pick(bucket: 0 | 1) {
    if (flash || finished) return;
    const ok = bucket === item.bucket;
    setAnswers((a) => [...a, ok]);
    setFlash(ok ? 'correct' : 'wrong');
  }

  return (
    <>
      <span className="lesson-kicker">Sortează</span>
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
          <p className="sort-count">{flash === 'wrong' ? `Merge la „${buckets[item.bucket]}”` : `${Math.min(i + 1, items.length)} din ${items.length}`}</p>
          <div className="tiles-row">
            {buckets.map((b, n) => (
              <button key={b} type="button" className="tile" disabled={!!flash} onClick={() => pick(n as 0 | 1)}>
                {b}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="play" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="play-big">
            {right} din {items.length}
          </div>
          <p className="play-caption">la locul lor din prima</p>
        </div>
      )}
      {finished && !flash && (
        <LessonBar
          tone={right === items.length ? 'correct' : 'wrong'}
          title={right === items.length ? 'Toate corect!' : 'Aproape'}
          body={explain}
          label="Continuă"
          onClick={() => onDone(right === items.length)}
        />
      )}
    </>
  );
}
