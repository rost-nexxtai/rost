'use client';

import { useState } from 'react';
import { LessonBar } from '../LessonBar';

const num = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1, useGrouping: 'always' });
// Intl writes a hyphen for negatives; a real minus sign reads better at display size.
export const showValue = (v: number, unit: string) =>
  (unit === '%' ? `${num.format(v)}%` : `${num.format(Math.round(v))} ${unit}`).replace('-', '−');

/** Close enough counts: within one step, or a tenth of the scale. */
export function isClose(guess: number, answer: number, min: number, max: number, step: number) {
  return Math.abs(guess - answer) <= Math.max(step, (max - min) / 10);
}

/**
 * Guess first, then see. The slider is the guess; after Verifică the real answer drops onto the
 * same scale next to yours, so the gap is something you see, not just read.
 */
export function PredictStep({
  kicker = 'Ghicește întâi',
  question,
  min,
  max,
  step,
  unit,
  start,
  answer,
  explain,
  onCheck,
  onDone,
}: {
  kicker?: string;
  question: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Where the slider starts. Keep it away from the real answer. */
  start?: number;
  answer: number;
  explain?: string;
  /** Real moments record the guess on the server before showing the answer. */
  onCheck?: (value: number) => Promise<void>;
  onDone: (correct: boolean) => void;
}) {
  const [value, setValue] = useState(start ?? min + Math.round((max - min) / 2 / step) * step);
  const [touched, setTouched] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = isClose(value, answer, min, max, step);
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;

  return (
    <>
      <span className="lesson-kicker">{kicker}</span>
      <h1 className="lesson-q">{question}</h1>
      <div className="dial">
        <div className="dial-value" aria-live="polite">
          {showValue(checked ? answer : value, unit)}
        </div>
        <div className="dial-track">
          {checked ? (
            <>
              <div className="bar" style={{ marginTop: 14 }} />
              <span className="dial-mark you" style={{ left: at(value) }}>
                <i />
                tu
              </span>
              <span className="dial-mark truth" style={{ left: at(answer) }}>
                <i />
                corect
              </span>
            </>
          ) : (
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              aria-label="Răspunsul tău"
              aria-valuetext={showValue(value, unit)}
              onChange={(e) => {
                setValue(Number(e.target.value));
                setTouched(true);
              }}
            />
          )}
        </div>
        <div className="dial-ends">
          <span>{showValue(min, unit)}</span>
          <span>{showValue(max, unit)}</span>
        </div>
      </div>
      {checked ? (
        <LessonBar
          tone={close ? 'correct' : 'wrong'}
          title={close ? 'Foarte aproape!' : `Răspunsul: ${showValue(answer, unit)}`}
          body={
            <>
              Tu ai zis {showValue(value, unit)}. {explain}
            </>
          }
          label="Continuă"
          onClick={() => onDone(close)}
        />
      ) : (
        <LessonBar
          label={busy ? 'Verificăm…' : 'Verifică'}
          disabled={!touched || busy}
          hint="Mută sliderul la răspunsul tău"
          onClick={async () => {
            setBusy(true);
            try {
              await onCheck?.(value);
              setChecked(true);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
