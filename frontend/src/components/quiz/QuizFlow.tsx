'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { saveQuiz } from '@/data/actions';
import { QUIZ } from '@/data/fixtures/quiz';
import type { AgeBand, KnowledgeAnswer, Profile, QuizAnswers, Situation } from '@/data/types';
import { QuizResult } from './QuizResult';

type Answer = string | number;
interface Screen {
  kicker: string;
  question: string;
  hint?: string;
  options: { value: Answer; label: string }[];
  row?: boolean;
}

const NU_STIU = { value: 'nu_stiu', label: 'Nu știu' };

const SCREENS: Screen[] = [
  { kicker: 'Despre tine', question: 'Câți ani ai?', options: QUIZ.profile.ageBand, row: true },
  { kicker: 'Despre tine', question: 'Ce faci acum?', options: QUIZ.profile.situation },
  {
    kicker: 'Despre tine',
    question: 'Dacă venitul s-ar opri mâine, cât ai trăi din economii?',
    options: QUIZ.profile.bufferMonths,
  },
  ...QUIZ.knowledge.map((q, n) => ({
    kicker: `Întrebare rapidă ${n + 1} din ${QUIZ.knowledge.length}`,
    question: q.question,
    hint: n === 0 ? 'Ca să știm de unde pornim. Nu e examen.' : undefined,
    options: [...q.options.map((label, value) => ({ value, label })), NU_STIU],
  })),
];

/** Onboarding: six screens, one tap each, no Continue button. Under a minute. */
export function QuizFlow() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [tapped, setTapped] = useState<Answer>();
  const [result, setResult] = useState<{ profile: Profile; note?: string }>();

  if (result) return <QuizResult profile={result.profile} note={result.note} />;
  const screen = SCREENS[i];

  async function finish(all: Answer[]) {
    const [ageBand, situation, bufferMonths, ...knowledge] = all;
    const quiz: QuizAnswers = {
      ageBand: ageBand as AgeBand,
      situation: situation as Situation,
      bufferMonths: bufferMonths as number,
      knowledge: knowledge as KnowledgeAnswer[],
    };
    let note: string | undefined;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situations: [quiz.situation] }),
      });
      if (!res.ok) throw new Error(res.statusText);
    } catch {
      note = 'Momentele de la bancă și din calendar apar când serverul e disponibil.';
    }
    setResult({ profile: await saveQuiz(quiz), note });
  }

  function pick(value: Answer) {
    if (tapped !== undefined) return;
    setTapped(value);
    const all = [...answers.slice(0, i), value];
    // A beat to see the tap land, then the next screen.
    setTimeout(() => {
      setAnswers(all);
      setTapped(undefined);
      if (i === SCREENS.length - 1) void finish(all);
      else setI(i + 1);
    }, 260);
  }

  const last = i === SCREENS.length - 1 && tapped !== undefined;

  return (
    <main className="onboard">
      <header className="lesson-top">
        {i === 0 ? (
          <Link href="/" className="lesson-close" aria-label="Înapoi">
            <Icon name="back" size={22} />
          </Link>
        ) : (
          <button type="button" className="lesson-close" aria-label="Întrebarea anterioară" onClick={() => setI(i - 1)}>
            <Icon name="back" size={22} />
          </button>
        )}
        <div className="segments" role="progressbar" aria-label={`Ecranul ${i + 1} din ${SCREENS.length}`} aria-valuemin={1} aria-valuemax={SCREENS.length} aria-valuenow={i + 1}>
          {SCREENS.map((_, n) => (
            <i key={n} data-on={n < i ? 'done' : n === i ? 'now' : undefined} />
          ))}
        </div>
      </header>

      <fieldset className="onboard-body" key={i}>
        <legend className="sr-only">{screen.question}</legend>
        <span className="lesson-kicker rise">{screen.kicker}</span>
        <h1 className="lesson-q rise">{screen.question}</h1>
        {screen.hint && <p className="onboard-hint">{screen.hint}</p>}
        <div className={screen.row ? 'tiles-row' : 'tiles'} style={screen.row ? { gridTemplateColumns: `repeat(${screen.options.length}, 1fr)` } : undefined}>
          {screen.options.map((o) => (
            <button
              key={String(o.value)}
              type="button"
              className="tile rise"
              style={o.value === 'nu_stiu' ? { color: 'var(--muted)', fontWeight: 500 } : undefined}
              aria-pressed={(tapped ?? answers[i]) === o.value}
              onClick={() => pick(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {last && <p className="play-hint">Îți pregătim prima lecție…</p>}
      </fieldset>
    </main>
  );
}
