'use client';

import { useState } from 'react';

const num = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1, useGrouping: 'always' });
export const showValue = (v: number, unit: string) => (unit === '%' ? `${num.format(v)}%` : `${num.format(Math.round(v))} ${unit}`);

/**
 * Guess first, then see. The guess is the hook and a learning metric (how far off people are).
 * Real moments check the answer on the server (onLock); library moments pass `answer` and reveal it here.
 */
export function PredictStep({
  question,
  min,
  max,
  step,
  unit,
  start,
  onLock,
  answer,
  onNext,
}: {
  question: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Where the slider starts. Keep it away from the real answer. */
  start?: number;
  onLock?: (value: number) => Promise<void>;
  /** Library moments: the answer to show once the guess is locked. */
  answer?: number;
  onNext?: () => void;
}) {
  const [value, setValue] = useState(start ?? (min + max) / 2);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  if (locked && answer !== undefined) {
    const diff = Math.abs(value - answer);
    const close = diff <= Math.max(step, Math.abs(answer) * 0.15);
    return (
      <div className="stack-lg rise">
        <span className="eyebrow">Răspunsul</span>
        <h1>{question}</h1>
        <div className="card">
          <div className="display-xl money pos">{showValue(answer, unit)}</div>
          <p className="muted">
            Tu ai zis {showValue(value, unit)}. {close ? 'Foarte aproape!' : 'Mulți ghicesc la fel. Hai să vedem de ce.'}
          </p>
        </div>
        <button className="btn btn-primary btn-block" onClick={onNext}>
          Mai departe
        </button>
      </div>
    );
  }

  return (
    <div className="stack-lg rise">
      <span className="eyebrow">Ghicește întâi</span>
      <h1>{question}</h1>
      <div className="card">
        <div className="display-xl money" aria-live="polite">
          {showValue(value, unit)}
        </div>
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => setValue(Number(e.target.value))} aria-label="Răspunsul tău" />
        <div className="row small muted">
          <span>{showValue(min, unit)}</span>
          <span>{showValue(max, unit)}</span>
        </div>
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onLock?.(value);
            setLocked(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        Blochează răspunsul
      </button>
    </div>
  );
}
