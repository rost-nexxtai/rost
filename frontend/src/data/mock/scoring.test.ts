import { describe, expect, it } from 'vitest';
import { QUIZ } from '../fixtures/quiz';
import type { KnowledgeAnswer } from '../types';
import { PERSONAS } from '../fixtures/personas';
import { CORE_MOMENTS, entryRoute, foundationFor, levelFromScore, levelWithMoments, profileFromQuiz, quizProfile, riskProfile, scoreKnowledge } from './scoring';

const all = (v: KnowledgeAnswer): KnowledgeAnswer[] => Array(3).fill(v);
const correct = QUIZ.knowledge.map((q) => q.correct);
const wrongAt = (n: number) => correct.map((c, i) => (i < n ? c : (c + 1) % QUIZ.knowledge[i].options.length));

describe('quiz level', () => {
  it('scores 1 as L0 and 3 as L2', () => {
    expect(levelFromScore(scoreKnowledge(wrongAt(1)))).toBe(0);
    expect(levelFromScore(scoreKnowledge(correct))).toBe(2);
  });

  it('scores three "Nu știu" answers as 0', () => {
    expect(scoreKnowledge(all('nu_stiu'))).toBe(0);
  });

  it('maps 0–1, 2–3 and 4 right answers to L0, L1, L2', () => {
    expect([0, 1, 2, 3, 4].map(levelFromScore)).toEqual([0, 0, 1, 1, 2]);
  });

  it('does not call the three basics "advanced": L2 needs the bond question too', () => {
    const basicsOnly = correct.map((c, i) => (i < 3 ? c : 'nu_stiu' as const));
    expect(levelFromScore(scoreKnowledge(basicsOnly))).toBe(1);
  });
});

describe('risk profile', () => {
  const base = { ageBand: 'sub_25', horizon: 'peste_3_ani', bufferMonths: 6, expensiveDebt: false } as const;

  it('adds one for under-30s', () => {
    expect(riskProfile({ ...base, level: 0 })).toBe('echilibrat');
    expect(riskProfile({ ...base, level: 2 })).toBe('dinamic');
    expect(riskProfile({ ...base, level: 0, ageBand: '30_plus' })).toBe('prudent');
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
