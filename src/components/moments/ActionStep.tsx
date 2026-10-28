'use client';

import { useState } from 'react';
import { lei } from '@/lib/format';

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
    <div className="stack" style={{ gap: 18 }}>
      <span className="eyebrow">One thing to do</span>
      <h1>{title}</h1>
      <p className="muted">{body}</p>
      {options.length > 0 && (
        <div className="grid3" role="group" aria-label="Amount">
          {options.map((o) => (
            <button key={o} className="chip" aria-pressed={choice === o} onClick={() => setChoice(o)}>
              {lei(o)}
            </button>
          ))}
        </div>
      )}
      <button
        className="btn btn-primary btn-block"
        disabled={busy || (options.length > 0 && choice === null)}
        onClick={async () => {
          setBusy(true);
          try {
            await onSubmit(choice);
          } finally {
            setBusy(false);
          }
        }}
      >
        {confirmLabel}
      </button>
    </div>
  );
}
