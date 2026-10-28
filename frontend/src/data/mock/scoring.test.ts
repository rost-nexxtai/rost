import { describe, expect, it } from 'vitest';
import { QUIZ } from '../fixtures/quiz';
import type { KnowledgeAnswer } from '../types';
import { PERSONAS } from '../fixtures/personas';
import { CORE_MOMENTS, entryRoute, foundationFor, levelWithMoments, passed, placement, profileFromQuiz, quizLevelOf, quizProfile, riskProfile, scoreKnowledge } from './scoring';

const correct = QUIZ.knowledge.map((q) => q.correct);
const wrong = (i: number) => (correct[i] + 1) % QUIZ.knowledge[i].options.length;
/** Right on the listed question indexes, wrong everywhere else. */
const rightOn = (...idx: number[]): KnowledgeAnswer[] => correct.map((c, i) => (idx.includes(i) ? c : wrong(i)));

describe('quiz level', () => {
  it('has two questions per level, in level order, like the backend', () => {
    expect(QUIZ.knowledge.map((q) => q.level)).toEqual([0, 0, 1, 1, 2, 2]);
  });

  it('places at L2 with everything right and at L0 with nothing right', () => {
    expect(quizLevelOf(correct)).toBe(2);
    expect(quizLevelOf(Array(6).fill('nu_stiu'))).toBe(0);
    expect(scoreKnowledge(Array(6).fill('nu_stiu'))).toBe(0);
  });

  it('needs both basics right before any higher level counts', () => {
    // one basic wrong, every hard question right: still L0
    expect(quizLevelOf(rightOn(0, 2, 3, 4, 5))).toBe(0);
    expect(quizLevelOf(rightOn(0, 1))).toBe(0);
    expect(quizLevelOf(rightOn(0, 1, 2))).toBe(1);
  });

  it('needs both L1 questions right before L2 counts', () => {
    expect(quizLevelOf(rightOn(0, 1, 2, 4, 5))).toBe(1);
    expect(quizLevelOf(rightOn(0, 1, 2, 3, 4))).toBe(2);
  });

  it('matches learning.Placement in Go', () => {
    const lv = [0, 0, 1, 1, 2, 2] as const;
    expect(placement([...lv], [true, true, true, true, false, false])).toBe(1);
    expect(placement([...lv], [true, true, false, false, true, true])).toBe(0);
    expect(placement([...lv], [true, true, false, true, false, true])).toBe(1);
  });
});

describe('passing a lesson', () => {
  it('needs two thirds of the graded screens right, or nothing graded', () => {
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
