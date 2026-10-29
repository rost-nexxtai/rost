'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import { feel } from '../feel';
import type { StepAnswer } from '../answers';

const KEYS = 'ABCDE';

/**
 * Pick one, press Verifică, see right or wrong with the reason. A wrong first pick (with three or
 * more options) gets a second try, like a tutor would give: the wrong option is crossed out and the
 * reason waits until the end. Only the first try counts for the score.
 */
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
  onDone: (correct: boolean, answer: StepAnswer) => void;
}) {
  const [picked, setPicked] = useState<number>();
  const [crossed, setCrossed] = useState<number[]>([]);
  // 'retry': the first pick was wrong and the second try hasn't started; 'done': the answer shows
  const [phase, setPhase] = useState<'pick' | 'retry' | 'done'>('pick');
  const t = LESSON[useLang().lang];
  const firstTry = crossed.length === 0;
  const right = picked === correct;
  const canRetry = options.length >= 3;

  function check() {
    if (picked === undefined) return;
    if (right) {
      feel('right');
      setPhase('done');
    } else {
      feel('wrong');
      if (firstTry && canRetry) {
        setCrossed([picked]);
        setPhase('retry');
      } else setPhase('done');
    }
  }

  return (
    <>
      <h1 className="lesson-q">{question}</h1>
      {kicker && <span className="lesson-hint">{kicker}</span>}
      <div className="tiles">
        {options.map((o, i) => {
          const out = crossed.includes(i);
          const state =
            phase === 'done' ? (i === correct ? 'correct' : i === picked || out ? 'wrong' : 'dim') : phase === 'retry' && out ? 'wrong' : out ? 'crossed' : undefined;
          return (
            <button
              key={o}
              type="button"
              className="tile"
              data-state={state}
              aria-pressed={phase === 'pick' && picked === i}
              disabled={phase !== 'pick' || out}
              onClick={() => setPicked(i)}
            >
              <span className="tile-key" aria-hidden="true">
                {KEYS[i]}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {phase === 'done' ? (
        <LessonBar
          tone={right ? 'correct' : 'wrong'}
          title={right ? (firstTry ? t.correct : t.secondTry) : t.notQuite}
          body={explain}
          label={t.continue}
          onClick={() => onDone(right && firstTry, { picked: firstTry ? picked : crossed[0] })}
        />
      ) : phase === 'retry' ? (
        <LessonBar
          tone="wrong"
          title={t.oneMoreTry}
          body={t.oneMoreTryBody}
          label={t.tryAgain}
          onClick={() => {
            setPicked(undefined);
            setPhase('pick');
          }}
          secondary={{ label: t.showAnswer, onClick: () => setPhase('done') }}
        />
      ) : (
        <LessonBar label={t.check} disabled={picked === undefined} hint={t.pickAnswer} onClick={check} />
      )}
    </>
  );
}
