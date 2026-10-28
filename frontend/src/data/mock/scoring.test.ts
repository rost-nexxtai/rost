import { describe, expect, it } from 'vitest';
import { QUIZ } from '../fixtures/quiz';
import type { KnowledgeAnswer } from '../types';
import { CORE_MOMENTS, entryRoute, foundationFor, levelFromScore, levelWithMoments, riskProfile, scoreKnowledge } from './scoring';

const all = (v: KnowledgeAnswer): KnowledgeAnswer[] => Array(6).fill(v);
const correct = QUIZ.knowledge.map((q) => q.correct);
const wrongAt = (n: number) => correct.map((c, i) => (i < n ? c : (c + 1) % QUIZ.knowledge[i].options.length));

describe('quiz level', () => {
  it('scores 1 as L0 and 6 as L2', () => {
    expect(levelFromScore(scoreKnowledge(wrongAt(1)))).toBe(0);
    expect(levelFromScore(scoreKnowledge(correct))).toBe(2);
  });

  it('scores six "Nu știu" answers as 0', () => {
    expect(scoreKnowledge(all('nu_stiu'))).toBe(0);
  });

  it('maps score bands 0–2, 3–4, 5–6 to L0, L1, L2', () => {
    expect([2, 3, 4, 5].map(levelFromScore)).toEqual([0, 1, 1, 2]);
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
