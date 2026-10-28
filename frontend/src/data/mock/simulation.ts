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

/** Real yearly return: what the rate buys after inflation, ((1 + rate) ÷ (1 + inflation) − 1). */
export function realRatePct(ratePct: number, inflationPct: number): number {
  return round2(((1 + ratePct / 100) / (1 + inflationPct / 100) - 1) * 100);
}

export interface InflationImpact {
  /** End value on paper. */
  nominalLei: number;
  /** The same end value in today's money. */
  realLei: number;
  /** What inflation takes: paper value minus today's money. */
  eatenLei: number;
  paidInLei: number;
  /** What you paid in, each deposit in today's money from the month it went in. */
  paidInRealLei: number;
  /** Today's money minus what you paid in (both in today's money): below zero, you can buy less than you put in. */
  realGainLei: number;
  /** The same deposits left in a current account at 0%, in today's money. */
  cashRealLei: number;
  realRatePct: number;
}

/** How much of a simulated result inflation eats, against doing nothing with the same money. */
export function inflationImpact(i: SimInput & { ratePct: number; inflationPct: number }): InflationImpact {
  const end = (p: Point[]) => p.at(-1)?.valueLei ?? 0;
  const { value, paidIn } = simulate(i);
  const nominalLei = end(value);
  const realLei = end(todayMoney(value, i.inflationPct));
  const cashRealLei = end(todayMoney(simulate({ ...i, ratePct: 0 }).value, i.inflationPct));
  // A deposit made in year 9 is worth less in today's money than one made now; deflate each from its month.
  let paidInReal = i.startLei;
  for (let m = 1; m <= i.years * 12; m++) paidInReal += i.monthlyLei / (1 + i.inflationPct / 100) ** (m / 12);
  const paidInRealLei = round2(paidInReal);
  return {
    nominalLei,
    realLei,
    eatenLei: round2(nominalLei - realLei),
    paidInLei: end(paidIn),
    paidInRealLei,
    realGainLei: round2(realLei - paidInRealLei),
    cashRealLei,
    realRatePct: realRatePct(i.ratePct, i.inflationPct),
  };
}
