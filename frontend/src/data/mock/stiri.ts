// The Știri sliders recompute in the browser with the same formulas as the backend's GET /api/stiri.
import type { MoneyLine, MoneyLines } from '../types';

/** Your monthly spend in the category × the shock on the slider. */
export function spendImpactLei(spendLei: number, pct: number): number {
  return Math.round((spendLei * pct) / 100);
}

/** What a year of inflation does to savings: amount × ((1 + rate) ÷ (1 + inflation) − 1). Negative is a loss. */
export function savingsLossLei(savedLei: number, inflationPct: number, ratePct = 0): number {
  return Math.round(savedLei * ((1 + ratePct / 100) / (1 + inflationPct / 100) - 1));
}

/** Ask for an amount only when the user hasn't given one: a known 0 is an answer. */
export function needsAmount(money: MoneyLines, line: MoneyLine): boolean {
  return money[line] <= 0 && !money.known?.includes(line);
}
