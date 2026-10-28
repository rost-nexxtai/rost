import { describe, expect, it } from 'vitest';
import { simulate, simulateRange, todayMoney } from './simulation';

describe('compound simulation', () => {
  it('compounds monthly: 1,000 lei at 6% for a year is 1,061.68', () => {
    expect(simulate({ startLei: 1000, monthlyLei: 0, years: 1, ratePct: 6 }).value[1].valueLei).toBe(1061.68);
  });

  it('adds monthly amounts and tracks what was paid in', () => {
    expect(simulate({ startLei: 0, monthlyLei: 100, years: 1, ratePct: 0 }).value[1].valueLei).toBe(1200);
    expect(simulate({ startLei: 0, monthlyLei: 100, years: 2, ratePct: 5 }).paidIn[2].valueLei).toBe(2400);
  });

  it("deflates to today's money at the given inflation", () => {
    expect(todayMoney([{ year: 1, valueLei: 1084.8 }], 8.48)[0].valueLei).toBeCloseTo(1000, 1);
  });

  it('stays finite at the slider extremes', () => {
    for (const s of [
      simulate({ startLei: 0, monthlyLei: 0, years: 40, ratePct: 7.5 }),
      simulate({ startLei: 1e6, monthlyLei: 1e4, years: 40, ratePct: 19.92 }),
    ])
      expect(s.value.every((p) => Number.isFinite(p.valueLei))).toBe(true);
  });

  it('runs worst, typical and best yearly returns for market assets', () => {
    const r = simulateRange({ startLei: 1000, monthlyLei: 0, years: 1 }, { worstPct: -0.19, typicalPct: 10.15, bestPct: 19.92 });
    expect(r.worst[1].valueLei).toBeLessThan(1000);
    expect(r.best[1].valueLei).toBeGreaterThan(r.typical[1].valueLei);
  });
});
