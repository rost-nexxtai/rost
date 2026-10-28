'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';

/** Multiple choice: pick, see right or wrong with a one-line explanation, then continue. */
export function ChoiceStep({
  question,
  options,
  correct,
  explain,
  onNext,
}: {
  question: string;
  options: string[];
  correct: number;
  explain: string;
  onNext: () => void;
}) {
  const [picked, setPicked] = useState<number>();
  const answered = picked !== undefined;

  return (
    <div className="stack-lg rise">
      <span className="eyebrow">Întrebare</span>
      <h1 style={{ fontSize: 26 }}>{question}</h1>
      <div className="stack">
        {options.map((o, i) => {
          const state = !answered ? undefined : i === correct ? 'correct' : i === picked ? 'wrong' : undefined;
          return (
            <button key={o} type="button" className="option" data-state={state} aria-pressed={picked === i} disabled={answered} onClick={() => setPicked(i)} style={{ cursor: answered ? 'default' : 'pointer', opacity: 1 }}>
              <span className="option-dot" aria-hidden="true">
                {state === 'correct' && <Icon name="check" size={14} />}
              </span>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className={`card ${picked === correct ? 'card-tint' : 'card-accent'} rise`} role="status">
          <strong>{picked === correct ? 'Corect.' : 'Nu chiar.'}</strong>
          <p className="small">{explain}</p>
        </div>
      )}
      <button className="btn btn-primary btn-block" disabled={!answered} onClick={onNext}>
        Mai departe
      </button>
    </div>
  );
}
