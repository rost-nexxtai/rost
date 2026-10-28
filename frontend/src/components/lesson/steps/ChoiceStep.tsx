'use client';

import { useState } from 'react';
import { LessonBar } from '../LessonBar';

const KEYS = 'ABCDE';

/** Pick one, press Verifică, see right or wrong with the reason. */
export function ChoiceStep({
  kicker,
  question,
  options,
  correct,
  explain,
  onDone,
}: {
  kicker?: string;
  question: string;
  options: string[];
  correct: number;
  explain: string;
  onDone: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number>();
  const [checked, setChecked] = useState(false);
  const right = picked === correct;

  return (
    <>
      {kicker && <span className="lesson-kicker">{kicker}</span>}
      <h1 className="lesson-q">{question}</h1>
      <div className="tiles">
        {options.map((o, i) => {
          const state = !checked ? undefined : i === correct ? 'correct' : i === picked ? 'wrong' : 'dim';
          return (
            <button key={o} type="button" className="tile" data-state={state} aria-pressed={!checked && picked === i} disabled={checked} onClick={() => setPicked(i)}>
              <span className="tile-key" aria-hidden="true">
                {KEYS[i]}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {checked ? (
        <LessonBar tone={right ? 'correct' : 'wrong'} title={right ? 'Corect!' : 'Nu chiar'} body={explain} label="Continuă" onClick={() => onDone(right)} />
      ) : (
        <LessonBar label="Verifică" disabled={picked === undefined} hint="Alege un răspuns" onClick={() => setChecked(true)} />
      )}
    </>
  );
}
