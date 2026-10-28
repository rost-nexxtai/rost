import { describe, expect, it } from 'vitest';
import { PERSONAS } from '../fixtures/personas';
import { QUIZ } from '../fixtures/quiz';
import type { Profile, QuizAnswers } from '../types';
import { buildAcasa } from './acasa';
import { profileFromQuiz } from './scoring';

const answers: QuizAnswers = { knowledge: [], ageBand: 'sub_25', situation: 'employed', bufferMonths: 0.5, expensiveDebt: false, horizon: 'peste_3_ani' };
const allCorrect = QUIZ.knowledge.map((q) => q.correct);
const wrongAtAll = QUIZ.knowledge.map((q) => (q.correct + 1) % q.options.length);
const l0 = profileFromQuiz({ ...answers, knowledge: wrongAtAll });
const l2 = profileFromQuiz({ ...answers, knowledge: allCorrect, bufferMonths: 6 });

describe('Acasă learning order', () => {
  it('shows only L0 assets "for your level" at L0, and all six at L2', () => {
    expect(buildAcasa(l0).forYourLevel.map((a) => a.id)).toEqual(['cont_economii', 'depozit']);
    expect(buildAcasa(l2).forYourLevel.map((a) => a.id)).toEqual(['cont_economii', 'depozit', 'titluri_stat', 'etf', 'actiuni', 'aur']);
    expect(buildAcasa(l0).later.map((a) => a.id)).toEqual(['titluri_stat', 'etf', 'actiuni', 'aur']);
  });

  it('puts the emergency fund first at every level when the buffer is under 3 months', () => {
    for (const level of [0, 1, 2] as const) {
      const p: Profile = { ...PERSONAS.maria, level, bufferMonths: 0.8 };
      expect(buildAcasa(p).foundation).toBe('fond_urgenta');
    }
  });

  it('flags assets above the risk profile without hiding them', () => {
    const p: Profile = { ...PERSONAS.maria, riskProfile: 'echilibrat' };
    expect(buildAcasa(p).later.find((a) => a.id === 'actiuni')?.aboveRiskProfile).toBe(true);
  });

  it('shows every asset at every level and never says "recommended"', () => {
    const all = [...buildAcasa(l2).forYourLevel, ...buildAcasa(l2).later];
    expect(all).toHaveLength(6);
    expect([...buildAcasa(l0).forYourLevel, ...buildAcasa(l0).later]).toHaveLength(6);
    expect(JSON.stringify(all).toLowerCase()).not.toContain('recomandat');
  });
});
