import { LessonBar } from '../LessonBar';

/** One number worth remembering, and a sentence on why. */
export function StatStep({ kicker, value, label, body, onDone }: { kicker?: string; value: string; label: string; body?: string; onDone: () => void }) {
  return (
    <>
      {kicker && <span className="lesson-kicker">{kicker}</span>}
      <div className="stat rise">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {body && <p className="lesson-text">{body}</p>}
      <LessonBar label="Continuă" onClick={onDone} />
    </>
  );
}
