'use client';

import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import { Widget, type WidgetId } from '../widgets';

/** Play with it: a live calculator on one idea. Playing is invited, not required: Continue is always on. */
export function ExploreStep({
  title,
  body,
  widget,
  haveMonths,
  onDone,
}: {
  title: string;
  body?: string;
  widget: WidgetId;
  /** Months of spending already saved, from onboarding (emergency-fund calculator). */
  haveMonths?: number;
  onDone: () => void;
}) {
  const t = LESSON[useLang().lang];
  return (
    <>
      <h1 className="lesson-q">{title}</h1>
      <span className="lesson-hint">{t.tryIt}</span>
      {body && <p className="lesson-text">{body}</p>}
      <Widget id={widget} onTouch={() => undefined} haveMonths={haveMonths} />
      <p className="play-hint">{t.moveSomething}</p>
      <LessonBar label={t.continue} onClick={onDone} />
    </>
  );
}
