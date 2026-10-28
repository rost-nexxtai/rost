'use client';

import { useState } from 'react';

const show = (v: number, unit: string) => (unit === '%' ? `${v.toFixed(1)}%` : `${Math.round(v).toLocaleString('en-US')} ${unit}`);

/** Guess first, then see. The guess is the hook and a learning metric (how far off people are). */
export function PredictStep({
  question,
  min,
  max,
  step,
  unit,
  start,
  onLock,
}: {
  question: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  /** Where the slider starts. Keep it away from the real answer. */
  start?: number;
  onLock: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState(start ?? min);
  const [busy, setBusy] = useState(false);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <span className="eyebrow">Guess first</span>
      <h1>{question}</h1>
      <div className="card">
        <div className="big" aria-live="polite">
          {show(value, unit)}
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Your guess"
        />
        <div className="row small muted">
          <span>{show(min, unit)}</span>
          <span>{show(max, unit)}</span>
        </div>
      </div>
      <button
        className="btn btn-primary btn-block"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onLock(value);
          } finally {
            setBusy(false);
          }
        }}
      >
        Lock my guess
      </button>
    </div>
  );
}
