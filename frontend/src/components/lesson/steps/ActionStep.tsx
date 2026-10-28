'use client';

import { useState } from 'react';
import { lei } from '@/lib/format';
import { LessonBar } from '../LessonBar';

/**
 * The one action at the end of a moment. Rost never moves money: the user does it in their own bank,
 * and we ask 7 days later whether it happened.
 */
export function ActionStep({
  title,
  body,
  options,
  defaultOption,
  confirmLabel,
  onSubmit,
}: {
  title: string;
  body: string;
  options: number[];
  defaultOption: number | null;
  confirmLabel: string;
  onSubmit: (choice: number | null) => Promise<void>;
}) {
  const [choice, setChoice] = useState<number | null>(defaultOption);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <span className="lesson-kicker">Un singur pas</span>
      <h1 className="lesson-q">{title}</h1>
      <p className="lesson-text">{body}</p>
      {options.length > 0 && (
        <div className="tiles-row" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="group" aria-label="Suma">
          {options.map((o) => (
            <button key={o} type="button" className="tile" aria-pressed={choice === o} onClick={() => setChoice(o)}>
              {lei(o)}
            </button>
          ))}
        </div>
      )}
      <LessonBar
        label={busy ? 'Salvăm…' : confirmLabel}
        disabled={busy || (options.length > 0 && choice === null)}
        hint="Alege o sumă"
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(choice);
          } finally {
            setBusy(false);
          }
        }}
      />
    </>
  );
}
