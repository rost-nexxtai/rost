'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import { Widget, type WidgetId } from '../widgets';

/** Play with it: a live calculator on one idea. Continue unlocks once you've moved something. */
export function ExploreStep({ title, body, widget, onDone }: { title: string; body?: string; widget: WidgetId; onDone: () => void }) {
  const [touched, setTouched] = useState(false);
  const t = LESSON[useLang().lang];
  return (
    <>
      <span className="lesson-kicker">{t.tryIt}</span>
      <h1 className="lesson-q">{title}</h1>
      {body && <p className="lesson-text">{body}</p>}
      <Widget id={widget} onTouch={() => setTouched(true)} />
      <LessonBar label={t.continue} disabled={!touched} hint={t.moveSomething} onClick={onDone} />
    </>
  );
}
