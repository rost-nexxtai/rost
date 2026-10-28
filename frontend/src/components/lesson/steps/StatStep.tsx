'use client';

import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';

/** One number worth remembering, and a sentence on why. */
export function StatStep({ kicker, value, label, body, onDone }: { kicker?: string; value: string; label: string; body?: string; onDone: () => void }) {
  const t = LESSON[useLang().lang];
  return (
    <>
      {kicker && <span className="lesson-kicker">{kicker}</span>}
      <div className="stat rise">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
      {body && <p className="lesson-text">{body}</p>}
      <LessonBar label={t.continue} onClick={onDone} />
    </>
  );
}
