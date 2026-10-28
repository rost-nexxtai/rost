'use client';

import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import type { FundStart } from '@/data/mock/money';
import { Widget, type WidgetId } from '../widgets';

/** Play with it: a live calculator on one idea. Playing is invited, not required: Continue is always on. */
export function ExploreStep({
  title,
  body,
  widget,
  you,
  onDone,
}: {
  title: string;
  body?: string;
  widget: WidgetId;
  /** The user's spending and savings, or labelled defaults (emergency-fund calculator). */
  you?: FundStart;
  onDone: () => void;
}) {
  const t = LESSON[useLang().lang];
  return (
    <>
      <h1 className="lesson-q">{title}</h1>
      <span className="lesson-hint">{t.tryIt}</span>
      {body && <p className="lesson-text">{body}</p>}
      <Widget id={widget} onTouch={() => undefined} you={you} />
      <p className="play-hint">{t.moveSomething}</p>
      <LessonBar label={t.continue} onClick={onDone} />
    </>
  );
}
