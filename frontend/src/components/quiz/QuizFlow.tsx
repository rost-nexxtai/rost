'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { saveQuiz } from '@/data/actions';
import { quizFor } from '@/data/fixtures/quiz';
import { useLang } from '@/i18n/client';
import { copy, type Lang } from '@/i18n/lang';
import type { AgeBand, KnowledgeAnswer, Profile, QuizAnswers, Situation } from '@/data/types';
import { QuizResult } from './QuizResult';

type Answer = string | number | boolean;
interface Screen {
  kicker: string;
  question: string;
  hint?: string;
  options: { value: Answer; label: string }[];
  row?: boolean;
}

const T = copy(
  {
    aboutYou: 'Despre tine',
    age: 'Câți ani ai?',
    situation: 'Ce faci acum?',
    buffer: 'Dacă venitul s-ar opri mâine, cât ai trăi din economii?',
    debt: 'Ai datorii scumpe?',
    debtHint: 'Card de credit neachitat integral, credit de nevoi personale sau „cumpără acum, plătește mai târziu”.',
    quick: (n: number, of: number) => `Întrebare rapidă ${n} din ${of}`,
    hint: 'Ca să știm de unde pornim. Nu e examen.',
    dontKnow: 'Nu știu',
    back: 'Înapoi',
    previous: 'Întrebarea anterioară',
    screen: (n: number, of: number) => `Ecranul ${n} din ${of}`,
    preparing: 'Îți pregătim prima lecție…',
  },
  {
    aboutYou: 'About you',
    age: 'How old are you?',
    situation: 'What do you do right now?',
    buffer: 'If your income stopped tomorrow, how long could you live on your savings?',
    debt: 'Do you have expensive debt?',
    debtHint: "A credit card you don't pay off in full, a personal loan, or \"buy now, pay later\".",
    quick: (n, of) => `Quick question ${n} of ${of}`,
    hint: "So we know where to start. It's not a test.",
    dontKnow: "I don't know",
    back: 'Back',
    previous: 'Previous question',
    screen: (n, of) => `Screen ${n} of ${of}`,
    preparing: 'Getting your first lesson ready…',
  },
);

function screensFor(lang: Lang): Screen[] {
  const t = T[lang];
  const quiz = quizFor(lang);
  return [
    { kicker: t.aboutYou, question: t.age, options: quiz.profile.ageBand, row: true },
    { kicker: t.aboutYou, question: t.situation, options: quiz.profile.situation },
    { kicker: t.aboutYou, question: t.buffer, options: quiz.profile.bufferMonths },
    { kicker: t.aboutYou, question: t.debt, hint: t.debtHint, options: quiz.profile.expensiveDebt, row: true },
    ...quiz.knowledge.map((q, n) => ({
      kicker: t.quick(n + 1, quiz.knowledge.length),
      question: q.question,
      hint: n === 0 ? t.hint : undefined,
      options: [...q.options.map((label, value) => ({ value, label })), { value: 'nu_stiu', label: t.dontKnow }],
    })),
  ];
}

/**
 * Onboarding: eight screens, one tap each, no Continue button. Under a minute.
 * `retake` (from Profil) keeps the session, name and finished lessons; a new user starts fresh.
 */
export function QuizFlow({ retake = false }: { retake?: boolean }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [tapped, setTapped] = useState<Answer>();
  const [result, setResult] = useState<Profile>();
  const { lang } = useLang();
  const t = T[lang];
  const SCREENS = screensFor(lang);

  if (result) return <QuizResult profile={result} />;
  const screen = SCREENS[i];

  async function finish(all: Answer[]) {
    const [ageBand, situation, bufferMonths, expensiveDebt, ...knowledge] = all;
    const quiz: QuizAnswers = {
      ageBand: ageBand as AgeBand,
      situation: situation as Situation,
      bufferMonths: bufferMonths as number,
      expensiveDebt: expensiveDebt as boolean,
      knowledge: knowledge as KnowledgeAnswer[],
    };
    if (!retake) {
      // A new user gets a backend session for triggered moments. If the API is down the lessons still
      // work, and Momente says so itself, so there's nothing to tell the user here.
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ situations: [quiz.situation] }),
      }).catch(() => undefined);
    }
    setResult(await saveQuiz(quiz, { retake }));
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
          <Link href="/" className="lesson-close" aria-label={t.back}>
            <Icon name="back" size={22} />
          </Link>
        ) : (
          <button type="button" className="lesson-close" aria-label={t.previous} onClick={() => setI(i - 1)}>
            <Icon name="back" size={22} />
          </button>
        )}
        <div className="segments" role="progressbar" aria-label={t.screen(i + 1, SCREENS.length)} aria-valuemin={1} aria-valuemax={SCREENS.length} aria-valuenow={i + 1}>
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
        {last && <p className="play-hint">{t.preparing}</p>}
      </fieldset>
    </main>
  );
}
