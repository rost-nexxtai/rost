// Pure money math behind the lesson widgets. Example rates only; the asset pages hold the ranked offers.

const DEPOSIT_TAX = 0.1;

/** Example rates used in the lessons (gross, per year). */
export const LESSON_RATES = { savingsPct: 3.8, deposit12Pct: 5.25, bondPct: 7.4, depositHighPct: 8 } as const;

/** Emergency-fund target: monthly expenses × months. */
export const fundTarget = (monthlyExpenses: number, months: number) => Math.max(0, monthlyExpenses) * months;

/** Whole months to reach a target saving a fixed amount each month, counting what's already saved. */
export function monthsToGoal(target: number, perMonth: number, have = 0): number {
  const left = target - Math.max(0, have);
  if (left <= 0) return 0;
  if (perMonth <= 0) return Infinity;
  return Math.ceil(left / perMonth);
}

/** Interest after the 10% tax on deposit interest. */
export const netDepositPct = (grossPct: number) => Math.round(grossPct * (1 - DEPOSIT_TAX) * 100) / 100;

/**
 * Net interest on `amount` if you need it after `months`: a savings account pays for the months it held
 * the money; a 12-month deposit broken early pays nothing (you usually lose the interest).
 */
export function savingsVsDeposit(amount: number, months: number) {
  const savings = Math.round((amount * netDepositPct(LESSON_RATES.savingsPct) * months) / 1200);
  const deposit = months >= 12 ? Math.round((amount * netDepositPct(LESSON_RATES.deposit12Pct)) / 100) : 0;
  return { savings, deposit };
}

/** One year: a deposit at 8% gross (taxed) against a tax-free state bond at 7.4%. */
export function bondsVsDeposit(amount: number) {
  const deposit = Math.round((amount * netDepositPct(LESSON_RATES.depositHighPct)) / 100);
  const bond = Math.round((amount * LESSON_RATES.bondPct) / 100);
  return { deposit, bond };
}

/** Share of the money lost if one company out of `n` (equal weights) goes to zero. */
export const lossIfOneFails = (n: number) => 100 / Math.max(1, n);

/** Monthly saving compounded monthly at a yearly rate: what you put in and what it is worth, per year. */
export function growth(monthly: number, ratePct: number, years: number) {
  const r = ratePct / 1200;
  let v = 0;
  const out: { year: number; paidIn: number; value: number }[] = [];
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) v = v * (1 + r) + monthly;
    out.push({ year: y, paidIn: monthly * 12 * y, value: Math.round(v) });
  }
  return out;
}
