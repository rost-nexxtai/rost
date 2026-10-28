'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
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
  const { lang, f } = useLang();
  const t = LESSON[lang];

  return (
    <>
      <span className="lesson-kicker">{t.oneStep}</span>
      <h1 className="lesson-q">{title}</h1>
      <p className="lesson-text">{body}</p>
      {options.length > 0 && (
        <div className="tiles-row" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }} role="group" aria-label={t.amount}>
          {options.map((o) => (
            <button key={o} type="button" className="tile" aria-pressed={choice === o} onClick={() => setChoice(o)}>
              {f.lei(o)}
            </button>
          ))}
        </div>
      )}
      <LessonBar
        label={busy ? t.saving : confirmLabel}
        disabled={busy || (options.length > 0 && choice === null)}
        hint={t.pickAmount}
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
