// MOCK until backend ships POST /api/quiz and level/risk profile on GET /api/me.
import { QUIZ } from '../fixtures/quiz';
import type { AgeBand, Foundation, KnowledgeAnswer, Level, MoneyHorizon, Profile, QuizAnswers, RiskProfile } from '../types';

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

/** Four quick questions: 0–1 right → L0, 2–3 → L1, all 4 (including the bond question) → L2. */
export function levelFromScore(score: number): Level {
  return score >= 4 ? 2 : score >= 2 ? 1 : 0;
}

/** Level + 1 if under 30 (0 prudent, 1–2 echilibrat, 3 dinamic), then the two caps. */
export function riskProfile(i: {
  level: Level;
  ageBand: AgeBand;
  horizon: MoneyHorizon;
  bufferMonths: number;
  expensiveDebt: boolean;
}): RiskProfile {
  if (i.horizon === 'sub_1_an') return 'prudent';
  const points = i.level + (i.ageBand === '30_plus' ? 0 : 1);
  const raw: RiskProfile = points === 0 ? 'prudent' : points >= 3 ? 'dinamic' : 'echilibrat';
  if ((i.bufferMonths < 3 || i.expensiveDebt) && raw === 'dinamic') return 'echilibrat';
  return raw;
}

/** The higher of the quiz level and the highest level whose lower-level core moments are all done. */
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
  const quizLevel = levelFromScore(quizScore);
  const level = levelWithMoments(quizLevel, []);
  const horizon = a.horizon ?? '1_3_ani';
  const expensiveDebt = a.expensiveDebt ?? false;
  return {
    name,
    quizScore,
    quizLevel,
    level,
    riskProfile: riskProfile({ level, ageBand: a.ageBand, horizon, bufferMonths: a.bufferMonths, expensiveDebt }),
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
