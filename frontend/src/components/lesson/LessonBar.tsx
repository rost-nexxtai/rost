'use client';

import { Icon } from '@/components/ui/Icon';

export type Tone = 'correct' | 'wrong' | 'info';

/**
 * The fixed bar at the bottom of a lesson screen: one button, and after "Verifică" the feedback
 * slides up above it, green when right, coral when not.
 */
export function LessonBar({
  tone,
  title,
  body,
  label,
  onClick,
  disabled,
  hint,
  secondary,
}: {
  tone?: Tone;
  title?: string;
  body?: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** A nudge shown above a disabled button, e.g. "Alege un răspuns". */
  hint?: string;
  /** A quieter second choice under the button, e.g. "Arată răspunsul". */
  secondary?: { label: string; onClick: () => void };
}) {
  return (
    <div className="lesson-bar" data-tone={tone}>
      <div className="lesson-bar-inner">
        {tone && title && (
          <div className="feedback" role="status">
            <span className="feedback-icon" aria-hidden="true">
              <Icon name={tone === 'correct' ? 'check' : tone === 'wrong' ? 'cross' : 'bulb'} size={20} />
            </span>
            <div>
              <div className="feedback-title">{title}</div>
              {body && <div className="feedback-body">{body}</div>}
            </div>
          </div>
        )}
        {!tone && hint && disabled && <div className="play-hint">{hint}</div>}
        <button type="button" className={`btn btn-block ${tone === 'wrong' ? 'btn-wrong' : 'btn-primary'}`} disabled={disabled} onClick={onClick} autoFocus={!!tone}>
          {label}
        </button>
        {secondary && (
          <button type="button" className="btn-text" onClick={secondary.onClick}>
            {secondary.label}
          </button>
        )}
      </div>
    </div>
  );
}
