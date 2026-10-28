import { describe, expect, it } from 'vitest';
import { inflationImpact, realRatePct, simulate, simulateRange, todayMoney } from './simulation';

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

describe('inflation impact', () => {
  it('computes the real rate: a 6.6% bond at 8.48% inflation loses about 1.7% a year', () => {
    expect(realRatePct(6.6, 8.48)).toBe(-1.73);
    expect(realRatePct(5, 0)).toBe(5);
  });

  it('splits a result into what inflation takes and what is left in today money', () => {
    // 10,000 lei for one year at 0%, with 10% inflation: on paper 10,000, really 9,090.91
    const r = inflationImpact({ startLei: 10000, monthlyLei: 0, years: 1, ratePct: 0, inflationPct: 10 });
    expect(r.nominalLei).toBe(10000);
    expect(r.realLei).toBeCloseTo(9090.91, 2);
    expect(r.eatenLei).toBeCloseTo(909.09, 2);
    expect(r.realGainLei).toBeCloseTo(-909.09, 2);
    expect(r.cashRealLei).toBeCloseTo(9090.91, 2);
  });

  it('shows a rate above inflation beating cash, and one below it still losing', () => {
    const above = inflationImpact({ startLei: 5000, monthlyLei: 400, years: 10, ratePct: 7.75, inflationPct: 6.61 });
    const below = inflationImpact({ startLei: 5000, monthlyLei: 400, years: 10, ratePct: 4.5, inflationPct: 6.61 });
    expect(above.realGainLei).toBeGreaterThan(0);
    expect(below.realGainLei).toBeLessThan(0);
    expect(below.realLei).toBeGreaterThan(below.cashRealLei);
    // cash at 0% always loses against inflation, measured the same way
    expect(below.cashRealLei).toBeLessThan(below.paidInRealLei);
    expect(above.paidInLei).toBe(53000);
    expect(above.paidInRealLei).toBeLessThan(53000);
  });
});
