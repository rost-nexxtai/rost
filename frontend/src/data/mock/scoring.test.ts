import { describe, expect, it } from 'vitest';
import { QUIZ } from '../fixtures/quiz';
import type { KnowledgeAnswer } from '../types';
import { PERSONAS } from '../fixtures/personas';
import { askQuestion, CORE_MOMENTS, entryRoute, foundationFor, levelWithMoments, passed, placeLevel, profileFromQuiz, quizProfile, riskProfile, scoreKnowledge } from './scoring';

// The placement cases and the backend's questions: the same files the Go tests read.
import placement from '../../../../backend/internal/learning/testdata/placement.json';
import backendQuiz from '../../../../backend/internal/reference/data/seed/quiz.json';

/** Every question answered right. */
const correct: KnowledgeAnswer[] = QUIZ.knowledge.map((q) => q.correct);

const cases = placement.cases as { name: string; answers: KnowledgeAnswer[]; level: number; asked: number }[];

/** How many knowledge questions onboarding shows for these answers (QuizFlow skips the rest). */
function asked(answers: KnowledgeAnswer[]): number {
  const given: KnowledgeAnswer[] = [];
  let n = 0;
  QUIZ.knowledge.forEach((_, i) => {
    if (askQuestion(i, given)) {
      n++;
      given.push(answers[i]);
    } else given.push('nu_stiu');
  });
  return n;
}

describe('quiz placement (shared cases with the backend)', () => {
  it.each(cases.map((c) => [c.name, c] as const))('%s', (_, c) => {
    expect(placeLevel(c.answers)).toBe(c.level);
    expect(asked(c.answers)).toBe(c.asked);
    expect(profileFromQuiz({ knowledge: c.answers, ageBand: '25_29', situation: 'employed', bufferMonths: 3 }).quizLevel).toBe(c.level);
  });

  it('asks the same questions, with the same right answers and tiers, as the backend', () => {
    const shape = (qs: { id: string; correct: number; tier: number; options: string[] }[]) => qs.map((q) => [q.id, q.correct, q.tier, q.options.length]);
    expect(shape(QUIZ.knowledge)).toEqual(shape(backendQuiz.knowledge));
    expect(QUIZ.knowledge.map((q) => q.question)).toEqual(backendQuiz.knowledge.map((q) => q.question));
  });

  it('still counts right answers for the score', () => {
    expect(scoreKnowledge(cases[0].answers)).toBe(QUIZ.knowledge.length);
    expect(scoreKnowledge(['nu_stiu', 'nu_stiu', 'nu_stiu', 'nu_stiu'])).toBe(0);
  });
});

describe('passing a lesson', () => {
  it('needs two thirds of the graded screens right, or nothing graded (learning.Passed)', () => {
    expect(passed(2, 3)).toBe(true);
    expect(passed(1, 3)).toBe(false);
    expect(passed(3, 4)).toBe(true);
    expect(passed(2, 4)).toBe(false);
    expect(passed(0, 0)).toBe(true);
  });
});

describe('risk profile', () => {
  const base = { horizon: 'peste_3_ani', bufferMonths: 6, expensiveDebt: false } as const;

  it('follows the level, with nothing added for age', () => {
    expect(riskProfile({ ...base, level: 0 })).toBe('prudent');
    expect(riskProfile({ ...base, level: 1 })).toBe('echilibrat');
    expect(riskProfile({ ...base, level: 2 })).toBe('dinamic');
  });

  it('caps at prudent when the money is needed within a year', () => {
    expect(riskProfile({ ...base, level: 2, horizon: 'sub_1_an' })).toBe('prudent');
  });

  it('caps at echilibrat without a 3-month buffer or with expensive debt', () => {
    expect(riskProfile({ ...base, level: 2, bufferMonths: 1 })).toBe('echilibrat');
    expect(riskProfile({ ...base, level: 2, expensiveDebt: true })).toBe('echilibrat');
  });
});

describe('level from completed moments', () => {
  it('moves up only when every lower-level core moment is done', () => {
    expect(levelWithMoments(0, ['fondul_urgenta', 'economii_vs_depozit'])).toBe(0);
    expect(levelWithMoments(0, CORE_MOMENTS[0])).toBe(1);
    expect(levelWithMoments(0, [...CORE_MOMENTS[0], ...CORE_MOMENTS[1]])).toBe(2);
  });

  it('never goes below the quiz level', () => {
    expect(levelWithMoments(2, [])).toBe(2);
  });
});

describe('foundation card', () => {
  it('puts the emergency fund before expensive debt, and nothing when both are fine', () => {
    expect(foundationFor({ bufferMonths: 0.8, expensiveDebt: true })).toBe('fond_urgenta');
    expect(foundationFor({ bufferMonths: 4, expensiveDebt: true })).toBe('datorii_scumpe');
    expect(foundationFor({ bufferMonths: 3, expensiveDebt: false })).toBe(null);
  });
});

describe('entry route', () => {
  it('sends a session without a profile to the quiz, not back to the landing page', () => {
    expect(entryRoute(false, false)).toBe('/');
    expect(entryRoute(true, false)).toBe('/quiz');
    expect(entryRoute(true, true)).toBe('/acasa');
  });
});

describe('onboarding answers that cap risk', () => {
  const base = { knowledge: correct, ageBand: 'sub_25', situation: 'employed', bufferMonths: 3 } as const;

  it('caps an advanced user with expensive debt at echilibrat and shows the debt card', () => {
    const p = profileFromQuiz({ ...base, expensiveDebt: true });
    expect(p.level).toBe(2);
    expect(p.riskProfile).toBe('echilibrat');
    expect(foundationFor(p)).toBe('datorii_scumpe');
  });

  it('lets the same user be dinamic without debt', () => {
    expect(profileFromQuiz({ ...base, expensiveDebt: false }).riskProfile).toBe('dinamic');
  });
});

describe('saving a quiz', () => {
  const answers = { knowledge: correct, ageBand: 'sub_25', situation: 'student', bufferMonths: 0, expensiveDebt: false } as const;
  const maria = { ...PERSONAS.maria, completedMomentIds: ['fondul_urgenta'] };

  it("starts a new user fresh, without the previous profile's name or progress", () => {
    const p = quizProfile(answers, maria, { retake: false });
    expect(p.name).toBeUndefined();
    expect(p.completedMomentIds).toEqual([]);
  });

  it('keeps the name, finished lessons and Știri amounts on a retake from Profil', () => {
    const p = quizProfile(answers, maria, { retake: true });
    expect(p.name).toBe('Maria');
    expect(p.completedMomentIds).toEqual(['fondul_urgenta']);
    expect(p.money).toEqual(maria.money);
  });
});

describe('what onboarding already told us', () => {
  it('counts "nothing put aside" as a known 0 in savings, so Știri does not ask again', () => {
    const p = profileFromQuiz({ knowledge: [], ageBand: 'sub_25', situation: 'student', bufferMonths: 0, expensiveDebt: false });
    expect(p.money.known).toContain('savedLei');
    const q = profileFromQuiz({ knowledge: [], ageBand: 'sub_25', situation: 'student', bufferMonths: 2, expensiveDebt: false });
    expect(q.money.known ?? []).not.toContain('savedLei');
  });
});
