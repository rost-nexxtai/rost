'use client';

export interface QuizOption<T> {
  value: T;
  label: string;
}

/** One question, one tap. The pressed option is announced, and the whole row is the target. */
export function QuizStep<T>({
  eyebrow,
  question,
  hint,
  options,
  value,
  onChange,
}: {
  eyebrow: string;
  question: string;
  hint?: string;
  options: QuizOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="stack-lg rise">
      <legend className="sr-only">{question}</legend>
      <span className="eyebrow">{eyebrow}</span>
      <h1 style={{ fontSize: 26 }}>{question}</h1>
      {hint && <p className="muted small">{hint}</p>}
      <div className="stack">
        {options.map((o) => (
          <button key={String(o.value)} type="button" className="option" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            <span className="option-dot" aria-hidden="true" />
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
