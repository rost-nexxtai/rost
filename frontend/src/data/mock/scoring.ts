// Same rules as backend/internal/learning (PlaceLevel, Risk); the cases in
// backend/internal/learning/testdata/placement.json run against both.
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

const rightAnswers = (answers: KnowledgeAnswer[]) => QUIZ.knowledge.map((q, i) => answers[i] === q.correct);

/**
 * The starting level (docs/level-assessment.md). Each question tests a tier; a tier passes when all
 * its questions are right, tiers pass in order, and the level is the number of tiers passed. So the
 * basics wrong means L0 whatever else was guessed, and one lucky guess can't pass a tier.
 * "Nu știu" and questions never asked count as not right.
 */
export function placeLevel(answers: KnowledgeAnswer[]): Level {
  const right = rightAnswers(answers);
  let level = 0;
  for (const tier of [0, 1] as const) {
    const qs = QUIZ.knowledge.map((q, i) => ({ q, i })).filter(({ q }) => q.tier === tier);
    if (qs.length === 0 || !qs.every(({ i }) => right[i])) break;
    level++;
  }
  return Math.min(level, 2) as Level;
}

/** Onboarding only asks a question while every earlier tier has passed; otherwise it can't change the level. */
export function askQuestion(index: number, answers: KnowledgeAnswer[]): boolean {
  const right = rightAnswers(answers);
  const tier = QUIZ.knowledge[index].tier;
  return QUIZ.knowledge.every((q, i) => q.tier >= tier || right[i]);
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
  const quizLevel = placeLevel(a.knowledge);
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
