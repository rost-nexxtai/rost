'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LessonBar } from '@/components/lesson/LessonBar';
import { Icon } from '@/components/ui/Icon';
import { Slider } from '@/components/ui/Slider';
import { nextLesson } from '@/data/actions';
import type { QuizResponse } from '@/contract';
import { quizFor } from '@/data/fixtures/quiz';
import { askQuestion } from '@/data/mock/scoring';
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
    quick: (tier: number, n: number, of: number) => (tier === 0 ? `Întrebare rapidă · ${n} din ${of}` : `Încă două, ceva mai grele · ${n} din ${of}`),
    hint: 'Ca să știm de unde pornim. Nu e examen.',
    dontKnow: 'Nu știu',
    back: 'Înapoi',
    previous: 'Întrebarea anterioară',
    screen: (n: number, of: number) => `Ecranul ${n} din ${of}`,
    preparing: 'Îți pregătim prima lecție…',
    saveFailed: 'Nu am putut salva răspunsurile: serverul nu răspunde. Mai încearcă o dată.',
    tryAgain: 'Încearcă din nou',
    gross: 'Cât e salariul tău brut pe lună?',
    grossHint: 'Suma din contract, înainte de taxe. O folosim doar ca să-ți arătăm unde merg banii din el.',
    grossLabel: 'Salariul brut',
    next: 'Continuă',
  },
  {
    aboutYou: 'About you',
    age: 'How old are you?',
    situation: 'What do you do right now?',
    buffer: 'If your income stopped tomorrow, how long could you live on your savings?',
    debt: 'Do you have expensive debt?',
    debtHint: "A credit card you don't pay off in full, a personal loan, or \"buy now, pay later\".",
    quick: (tier, n, of) => (tier === 0 ? `Quick question · ${n} of ${of}` : `Two more, a bit harder · ${n} of ${of}`),
    hint: "So we know where to start. It's not a test.",
    dontKnow: "I don't know",
    back: 'Back',
    previous: 'Previous question',
    screen: (n, of) => `Screen ${n} of ${of}`,
    preparing: 'Getting your first lesson ready…',
    saveFailed: "We couldn't save your answers: the server isn't answering. Please try again.",
    tryAgain: 'Try again',
    gross: "What's your gross monthly salary?",
    grossHint: 'The amount in your contract, before tax. We only use it to explain your payslip.',
    grossLabel: 'Gross salary',
    next: 'Continue',
  },
);

/** Age, situation, savings cushion, expensive debt: the screens before the knowledge questions. */
const PROFILE_SCREENS = 4;
/** The situation screen. "Am un job" adds a salary step after it, so the first lesson can be the payslip. */
const SITUATION = 1;

function screensFor(lang: Lang): Screen[] {
  const t = T[lang];
  const quiz = quizFor(lang);
  return [
    { kicker: t.aboutYou, question: t.age, options: quiz.profile.ageBand, row: true },
    { kicker: t.aboutYou, question: t.situation, options: quiz.profile.situation },
    { kicker: t.aboutYou, question: t.buffer, options: quiz.profile.bufferMonths },
    { kicker: t.aboutYou, question: t.debt, hint: t.debtHint, options: quiz.profile.expensiveDebt, row: true },
    ...quiz.knowledge.map((q, n) => ({
      // Numbered within its tier, so a beginner who stops after the basics never sees "2 of 4".
      kicker: t.quick(q.tier, quiz.knowledge.slice(0, n).filter((p) => p.tier === q.tier).length + 1, quiz.knowledge.filter((p) => p.tier === q.tier).length),
      question: q.question,
      hint: n === 0 ? t.hint : undefined,
      options: [...q.options.map((label, value) => ({ value, label })), { value: 'nu_stiu', label: t.dontKnow }],
    })),
  ];
}

/**
 * Onboarding: six to eight screens, one tap each, no Continue button. Under a minute.
 * `retake` (from Profil) keeps the session, name and finished lessons; a new user starts fresh.
 */
export function QuizFlow({ retake = false }: { retake?: boolean }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [tapped, setTapped] = useState<Answer>();
  const [finishing, setFinishing] = useState(false);
  const [failed, setFailed] = useState<Answer[]>();
  const [result, setResult] = useState<{ profile: Profile; lesson: Awaited<ReturnType<typeof nextLesson>> }>();
  const [gross, setGross] = useState<number>();
  const [askGross, setAskGross] = useState(false);
  const { lang, f } = useLang();
  const t = T[lang];
  const SCREENS = screensFor(lang);

  if (result) return <QuizResult profile={result.profile} lesson={result.lesson} grossMonthly={gross} />;
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
    setFailed(undefined);
    try {
      // A new user starts a new session (someone else may have used this browser); a retake from
      // Profil keeps theirs, with its lessons and numbers. The backend scores the quiz and, for a
      // new user, sets the session cookie on this response.
      if (!retake) await fetch('/api/users', { method: 'DELETE' });
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...quiz, ...(gross !== undefined && { grossMonthly: gross }) }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { profile } = (await res.json()) as QuizResponse;
      setResult({ profile, lesson: await nextLesson(profile) });
    } catch {
      setFinishing(false);
      setFailed(all);
    }
  }

  function pick(value: Answer) {
    if (tapped !== undefined) return;
    setTapped(value);
    const all = [...answers.slice(0, i), value];
    if (i === SITUATION) {
      if (value !== 'employed') setGross(undefined);
      else {
        setTimeout(() => {
          setAnswers(all);
          setTapped(undefined);
          setGross((g) => g ?? 6000);
          setAskGross(true);
        }, 260);
        return;
      }
    }
    // Skip the questions that can't change the level any more (a later tier when the basics
    // weren't both right). They count as "Nu știu".
    let next = i + 1;
    while (next < SCREENS.length && next >= PROFILE_SCREENS && !askQuestion(next - PROFILE_SCREENS, all.slice(PROFILE_SCREENS) as KnowledgeAnswer[])) {
      all.push('nu_stiu');
      next++;
    }
    if (next >= SCREENS.length) setFinishing(true);
    // A beat to see the tap land, then the next screen.
    setTimeout(() => {
      setAnswers(all);
      setTapped(undefined);
      if (next >= SCREENS.length) void finish(all);
      else setI(next);
    }, 260);
  }

  if (askGross) {
    return (
      <main className="onboard">
        <header className="lesson-top">
          <button type="button" className="lesson-close" aria-label={t.previous} onClick={() => setAskGross(false)}>
            <Icon name="back" size={22} />
          </button>
          <div className="segments" aria-hidden="true">
            {SCREENS.map((_, n) => (
              <i key={n} data-on={n <= i ? 'done' : undefined} />
            ))}
          </div>
        </header>
        <div className="onboard-body">
          <h1 className="lesson-q rise">{t.gross}</h1>
          <span className="lesson-hint rise">{t.aboutYou}</span>
          <p className="onboard-hint">{t.grossHint}</p>
          <Slider label={t.grossLabel} min={3000} max={30000} step={250} value={gross ?? 6000} onChange={setGross} format={f.lei} />
        </div>
        <LessonBar
          label={t.next}
          onClick={() => {
            setAskGross(false);
            setI(SITUATION + 1);
          }}
        />
      </main>
    );
  }

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
        <h1 className="lesson-q rise">{screen.question}</h1>
        <span className="lesson-hint rise">{screen.kicker}</span>
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
        {finishing && <p className="play-hint">{t.preparing}</p>}
        {failed && (
          <div className="stack" style={{ gap: 10 }}>
            <p className="error">{t.saveFailed}</p>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => {
                setFinishing(true);
                void finish(failed);
              }}
            >
              {t.tryAgain}
            </button>
          </div>
        )}
      </fieldset>
    </main>
  );
}
