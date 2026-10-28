import { describe, expect, it } from 'vitest';
import { firstLesson } from '@/data/mock/momente';
import { SEED_LESSONS } from '@/data/fixtures/seed-lessons';
import { PERSONAS } from '@/data/fixtures/personas';
import { profileFromQuiz } from '@/data/mock/scoring';
import { bondsVsDeposit, fundTarget, growth, lossIfOneFails, monthsToGoal, netDepositPct, savingsVsDeposit } from './math';
import { isClose } from './steps/PredictStep';

describe('lesson math', () => {
  it('emergency fund: target and months to get there', () => {
    expect(fundTarget(2500, 3)).toBe(7500);
    expect(monthsToGoal(7500, 400)).toBe(19);
    expect(monthsToGoal(7500, 0)).toBe(Infinity);
    expect(monthsToGoal(7500, 300, 2500)).toBe(17); // a month already saved counts
    expect(monthsToGoal(7500, 300, 9000)).toBe(0);
  });

  it('a deposit broken early pays nothing; kept a year it beats savings', () => {
    expect(netDepositPct(5)).toBe(4.5);
    expect(savingsVsDeposit(10_000, 6)).toEqual({ savings: 171, deposit: 0 });
    expect(savingsVsDeposit(10_000, 12)).toEqual({ savings: 342, deposit: 473 });
  });

  it('a tax-free 7.4% bond beats an 8% deposit after tax', () => {
    expect(bondsVsDeposit(10_000)).toEqual({ deposit: 720, bond: 740 });
  });

  it('diversification and compounding', () => {
    expect(lossIfOneFails(1)).toBe(100);
    expect(lossIfOneFails(100)).toBe(1);
    const g = growth(200, 6, 38);
    expect(g.at(-1)!.paidIn).toBe(91_200);
    expect(g.at(-1)!.value).toBe(348_852); // Ana, in the compound-interest lesson
    expect(growth(400, 6, 28).at(-1)!.value).toBe(347_451); // Mihai
    expect(growth(0, 6, 1)).toEqual([{ year: 1, paidIn: 0, value: 0 }]);
  });

  it('a guess counts as close within a step or a tenth of the scale', () => {
    expect(isClose(4, 3, 0, 12, 1)).toBe(true);
    expect(isClose(6, 3, 0, 12, 1)).toBe(false);
  });

  it('counts any guess inside an accepted range as right', () => {
    expect(isClose(6, 3, 0, 12, 1, [3, 6])).toBe(true);
    expect(isClose(3, 3, 0, 12, 1, [3, 6])).toBe(true);
    expect(isClose(8, 3, 0, 12, 1, [3, 6])).toBe(false);
  });

  it('gives every sorting card a reason, so a wrong tap can explain itself', () => {
    // English reasons are checked by the backend, which refuses a translation without them.
    const items = SEED_LESSONS.flatMap((m) => m.steps.flatMap((s) => (s.type === 'sort' ? s.items : [])));
    expect(items.length).toBeGreaterThan(0);
    expect(items.filter((i) => !i.why?.trim()).map((i) => i.label)).toEqual([]);
  });

  it('accepts 3 to 6 months in the emergency-fund lesson', () => {
    const step = SEED_LESSONS.find((m) => m.id === 'fondul_urgenta')!.steps.find((s) => s.type === 'predict');
    expect(step && 'acceptRange' in step ? step.acceptRange : undefined).toEqual([3, 6]);
  });
});

describe('library lessons', () => {
  const playable = SEED_LESSONS.filter((m) => m.steps.length > 0);

  it('has the three foundation lessons playable', () => {
    expect(playable.filter((m) => m.level === 0).map((m) => m.id)).toEqual(['fondul_urgenta', 'economii_vs_depozit', 'dobanda_compusa']);
  });

  it.each(playable.map((m) => [m.id, m] as const))('%s is short, well-formed and ends on a finish screen', (_, m) => {
    expect(m.steps.length).toBeLessThanOrEqual(7);
    expect(m.steps.at(-1)!.type).toBe('finish');
    expect(m.takeaways.length).toBeGreaterThanOrEqual(2);
    expect(m.steps.filter((s) => s.type === 'choice' || s.type === 'predict' || s.type === 'sort').length).toBeGreaterThanOrEqual(2);
    for (const s of m.steps) {
      if (s.type === 'choice') expect(s.options[s.correct]).toBeDefined();
      if (s.type === 'predict') {
        expect(s.answerValue).toBeGreaterThanOrEqual(s.min);
        expect(s.answerValue).toBeLessThanOrEqual(s.max);
        // The slider must not start on (or next to) the answer.
        if (s.start !== undefined) expect(isClose(s.start, s.answerValue, s.min, s.max, s.step)).toBe(false);
      }
      if (s.type === 'sort') {
        expect(new Set(s.items.map((i) => i.bucket))).toEqual(new Set([0, 1]));
      }
    }
  });
});

describe('first lesson after onboarding', () => {
  it('starts with the emergency fund when there is none', () => {
    expect(firstLesson(PERSONAS.maria, SEED_LESSONS)?.id).toBe('fondul_urgenta');
  });

  it('starts at your level when the foundation is there', () => {
    const p = profileFromQuiz({ knowledge: [2, 1, 0, 1], ageBand: '25_29', situation: 'employed', bufferMonths: 3, expensiveDebt: false });
    expect(p.level).toBe(2);
    expect(firstLesson(p, SEED_LESSONS)?.level).toBeLessThanOrEqual(2);
    const l1 = profileFromQuiz({ knowledge: [2, 1, 'nu_stiu', 'nu_stiu'], ageBand: '25_29', situation: 'employed', bufferMonths: 3, expensiveDebt: false });
    expect(firstLesson(l1, SEED_LESSONS)?.id).toBe('titluri_stat');
  });
});
