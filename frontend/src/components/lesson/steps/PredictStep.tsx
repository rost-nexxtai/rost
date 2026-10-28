'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import type { Lang } from '@/i18n/lang';
import type { Hit } from '../LessonShell';
import { num } from '@/lib/format';

// Intl writes a hyphen for negatives; a real minus sign reads better at display size.
export const showValue = (v: number, unit: string, lang: Lang = 'ro') =>
  (unit === '%' ? `${num(v, lang)}%` : `${num(Math.round(v), lang)} ${unit}`).replace('-', '−');

/**
 * Close enough counts: within one step, or a tenth of the scale. When the honest answer is a range
 * (3–6 months of spending), anything inside it is right.
 */
export function isClose(guess: number, answer: number, min: number, max: number, step: number, accept?: [number, number]) {
  if (accept && guess >= accept[0] && guess <= accept[1]) return true;
  return Math.abs(guess - answer) <= Math.max(step, (max - min) / 10);
}

/**
 * Guess first, then see. The slider is the guess; after Verifică the real answer drops onto the
 * same scale next to yours, so the gap is something you see, not just read.
 */
export function PredictStep({
  kicker,
  question,
  min,
  max,
  step,
  unit,
  start,
  answer,
  acceptRange,
  explain,
  onCheck,
  onHit,
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
  /** Every guess in this range is right; `answer` is still the value shown. */
  acceptRange?: [number, number];
  explain?: string;
  /** Real moments record the guess on the server before showing the answer. */
  onCheck?: (value: number) => Promise<void>;
  onHit?: (hit: Hit) => void;
  onDone: (correct: boolean) => void;
}) {
  const [value, setValue] = useState(start ?? min + Math.round((max - min) / 2 / step) * step);
  const [touched, setTouched] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const { lang } = useLang();
  const t = LESSON[lang];
  const show = (v: number) => showValue(v, unit, lang);
  const inRange = !!acceptRange && value >= acceptRange[0] && value <= acceptRange[1];
  const close = isClose(value, answer, min, max, step, acceptRange);
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`;

  return (
    <>
      <span className="lesson-kicker">{kicker ?? t.guessFirst}</span>
      <h1 className="lesson-q">{question}</h1>
      <div className="dial">
        <div className="dial-value" aria-live="polite">
          {show(checked ? answer : value)}
        </div>
        <div className="dial-track">
          {checked ? (
            <>
              <div className="bar" style={{ marginTop: 14 }} />
              <span className="dial-mark you" style={{ left: at(value) }}>
                <i />
                {t.you}
              </span>
              <span className="dial-mark truth" style={{ left: at(answer) }}>
                <i />
                {t.right}
              </span>
            </>
          ) : (
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              aria-label={t.yourAnswer}
              aria-valuetext={show(value)}
              onChange={(e) => {
                setValue(Number(e.target.value));
                setTouched(true);
              }}
              // Touching the slider is enough: a guess can be exactly where it started.
              onPointerDown={() => setTouched(true)}
              onKeyDown={() => setTouched(true)}
            />
          )}
        </div>
        <div className="dial-ends">
          <span>{show(min)}</span>
          <span>{show(max)}</span>
        </div>
      </div>
      {checked ? (
        <LessonBar
          tone={close ? 'correct' : 'wrong'}
          title={inRange ? t.correct : close ? t.veryClose : t.theAnswer(show(answer))}
          body={
            <>
              {t.youSaid(show(value))} {explain}
            </>
          }
          label={t.continue}
          onClick={() => onDone(close)}
        />
      ) : (
        <LessonBar
          label={busy ? t.checking : t.check}
          disabled={!touched || busy}
          hint={t.moveSlider}
          onClick={async () => {
            setBusy(true);
            try {
              await onCheck?.(value);
              setChecked(true);
              onHit?.(close ? 'right' : 'wrong');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </>
  );
}
