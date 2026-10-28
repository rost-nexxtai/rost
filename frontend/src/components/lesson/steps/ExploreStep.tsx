'use client';

import { useState } from 'react';
import { LessonBar } from '../LessonBar';
import { Widget, type WidgetId } from '../widgets';

/** Play with it: a live calculator on one idea. Continue unlocks once you've moved something. */
export function ExploreStep({ title, body, widget, onDone }: { title: string; body?: string; widget: WidgetId; onDone: () => void }) {
  const [touched, setTouched] = useState(false);
  return (
    <>
      <span className="lesson-kicker">Încearcă</span>
      <h1 className="lesson-q">{title}</h1>
      {body && <p className="lesson-text">{body}</p>}
      <Widget id={widget} onTouch={() => setTouched(true)} />
      <LessonBar label="Continuă" disabled={!touched} hint="Mută ceva și vezi ce se schimbă" onClick={onDone} />
    </>
  );
}
