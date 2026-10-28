// MOCK until backend ships POST /api/quiz and level/risk profile on GET /api/me.
import { QUIZ } from '../fixtures/quiz';
import type { Foundation, KnowledgeAnswer, Level, MoneyHorizon, Profile, QuizAnswers, RiskProfile } from '../types';

export const NATIONAL_INFLATION_PCT = 6.61;

/** Core moments per lesson level. Finishing all of a level's core moments moves the user up. */
export const CORE_MOMENTS: Record<Level, string[]> = {
  0: ['fondul_urgenta', 'economii_vs_depozit', 'dobanda_compusa'],
  1: ['titluri_stat', 'etf'],
  2: ['actiuni', 'aur'],
};

export function scoreKnowledge(answers: KnowledgeAnswer[]): number {
  return QUIZ.knowledge.reduce((n, q, i) => n + (answers[i] === q.correct ? 1 : 0), 0);
}

/**
 * Mirrors learning.Placement in Go: you place at a level only with every question below it right
 * and at least one of its own. Lucky guesses on the hard questions don't skip the basics.
 */
export function placement(levels: Level[], right: boolean[]): Level {
  let placed: Level = 0;
  for (const l of [1, 2] as const) {
    const below = levels.every((ql, i) => ql >= l || right[i]);
    const own = levels.some((ql, i) => ql === l && right[i]);
    if (!below || !own) break;
    placed = l;
  }
  return placed;
}

/** The starting level from the quiz answers ("Nu știu" counts as wrong). */
export function quizLevelOf(answers: KnowledgeAnswer[]): Level {
  return placement(
    QUIZ.knowledge.map((q) => q.level),
    QUIZ.knowledge.map((q, i) => answers[i] === q.correct),
  );
}

/** Mirrors learning.Passed: a lesson counts toward the next level only with 2 of 3 graded screens right. */
export function passed(correct: number, total: number): boolean {
  return total === 0 || correct * 3 >= total * 2;
}

/** Mirrors learning.Risk: the level sets it (0 prudent, 1 echilibrat, 2 dinamic), then the caps. Age adds nothing. */
export function riskProfile(i: {
  level: Level;
  horizon: MoneyHorizon;
  bufferMonths: number;
  expensiveDebt: boolean;
}): RiskProfile {
  if (i.horizon === 'sub_1_an') return 'prudent';
  const raw: RiskProfile = i.level === 0 ? 'prudent' : i.level === 2 ? 'dinamic' : 'echilibrat';
  if ((i.bufferMonths < 3 || i.expensiveDebt) && raw === 'dinamic') return 'echilibrat';
  return raw;
}

/** The higher of the quiz level and the highest level whose lower-level core moments are all passed. */
export function levelWithMoments(quizLevel: Level, completed: string[]): Level {
  const done = (l: Level) => CORE_MOMENTS[l].every((id) => completed.includes(id));
  const earned: Level = done(0) ? (done(1) ? 2 : 1) : 0;
  return Math.max(quizLevel, earned) as Level;
}

export function foundationFor(p: Pick<Profile, 'bufferMonths' | 'expensiveDebt'>): Foundation {
  if (p.bufferMonths < 3) return 'fond_urgenta';
  if (p.expensiveDebt) return 'datorii_scumpe';
  return null;
}

export function profileFromQuiz(a: QuizAnswers, name?: string): Profile {
  const quizScore = scoreKnowledge(a.knowledge);
  const quizLevel = quizLevelOf(a.knowledge);
  const level = levelWithMoments(quizLevel, []);
  const horizon = a.horizon ?? '1_3_ani';
  const expensiveDebt = a.expensiveDebt ?? false;
  return {
    name,
    quizScore,
    quizLevel,
    level,
    riskProfile: riskProfile({ level, horizon, bufferMonths: a.bufferMonths, expensiveDebt }),
    ageBand: a.ageBand,
    situation: a.situation,
    bufferMonths: a.bufferMonths,
    expensiveDebt,
    horizon,
    money: {
      fuelLei: a.fuelLei ?? 0,
      electricityLei: a.electricityLei ?? 0,
      savedLei: a.savedLei ?? 0,
      inflationPct: NATIONAL_INFLATION_PCT,
      // "Nothing put aside" already answers the savings question.
      known: a.bufferMonths === 0 && a.savedLei === undefined ? ['savedLei'] : undefined,
    },
    completedMomentIds: [],
  };
}

/**
 * The profile a finished quiz saves. A new user starts fresh; a retake from Profil keeps the
 * name, finished lessons and money amounts, because the quiz level is a floor, not a reset.
 */
export function quizProfile(a: QuizAnswers, previous: Profile | undefined, opts: { retake: boolean }): Profile {
  const keep = opts.retake ? previous : undefined;
  const p = profileFromQuiz(a, keep?.name);
  const completedMomentIds = keep?.completedMomentIds ?? [];
  // Amounts given in Știri stay too; only the quiz answers change.
  const money = keep?.money ?? p.money;
  return { ...p, money, completedMomentIds, level: levelWithMoments(p.quizLevel, completedMomentIds) };
}

/** Where someone lands: no session → landing, session but no profile → quiz, both → Acasă. */
export function entryRoute(hasSession: boolean, hasProfile: boolean): '/' | '/quiz' | '/acasa' {
  if (!hasSession) return '/';
  return hasProfile ? '/acasa' : '/quiz';
}
