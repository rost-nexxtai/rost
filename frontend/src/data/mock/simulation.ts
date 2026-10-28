// MOCK until backend ships simulation series on GET /api/assets/:id.
import type { Point, SimInput } from '../types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Start amount plus a monthly amount, compounded monthly at the yearly rate, sampled at each year end. */
export function simulate(i: SimInput & { ratePct: number }): { value: Point[]; paidIn: Point[] } {
  const r = i.ratePct / 1200;
  let v = i.startLei;
  const value: Point[] = [{ year: 0, valueLei: round2(v) }];
  const paidIn: Point[] = [{ year: 0, valueLei: round2(i.startLei) }];
  for (let year = 1; year <= i.years; year++) {
    for (let m = 0; m < 12; m++) v = v * (1 + r) + i.monthlyLei;
    value.push({ year, valueLei: round2(v) });
    paidIn.push({ year, valueLei: round2(i.startLei + i.monthlyLei * 12 * year) });
  }
  return { value, paidIn };
}

/** The same values in today's money, at a constant yearly inflation. */
export function todayMoney(value: Point[], inflationPct: number): Point[] {
  return value.map((p) => ({ year: p.year, valueLei: round2(p.valueLei / (1 + inflationPct / 100) ** p.year) }));
}

/** Three runs from history (worst, typical, best 10-year yearly return), never one rising line. */
export function simulateRange(
  i: SimInput,
  r: { worstPct: number; typicalPct: number; bestPct: number },
): { worst: Point[]; typical: Point[]; best: Point[] } {
  return {
    worst: simulate({ ...i, ratePct: r.worstPct }).value,
    typical: simulate({ ...i, ratePct: r.typicalPct }).value,
    best: simulate({ ...i, ratePct: r.bestPct }).value,
  };
}
