// Pure money math behind the lesson widgets. The asset pages hold the ranked offers.

const DEPOSIT_TAX = 0.1;

/** Rates used in the lessons (gross, per year): savings and deposit12 are examples; bond and depositHigh are the real October 2026 Tezaur 1 year and best 1-year deposit. */
export const LESSON_RATES = { savingsPct: 3.8, deposit12Pct: 5.25, bondPct: 6.5, depositHighPct: 7 } as const;

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

/** How much a price must rise after falling `fallPct`% to get back where it started: 50 → 100. */
export const recoveryPct = (fallPct: number) => (fallPct >= 100 ? Infinity : (100 / (100 - fallPct) - 1) * 100);

/** Whole years to get back after a fall, growing `ratePct`% a year. */
export function yearsToRecover(fallPct: number, ratePct: number): number {
  if (fallPct <= 0) return 0;
  if (fallPct >= 100 || ratePct <= 0) return Infinity;
  return Math.ceil(Math.log(100 / (100 - fallPct)) / Math.log(1 + ratePct / 100));
}

/**
 * Calendar-year returns in dollars, %: shares = MSCI World (gross), gold = GLD, commodities =
 * Bloomberg Commodity Index (total return). Four years where they went different ways.
 */
export const MARKET_YEARS = [
  { year: 2008, shares: -40.33, gold: 4.92, commodities: -35.65 },
  { year: 2013, shares: 27.37, gold: -28.33, commodities: -9.52 },
  { year: 2020, shares: 16.5, gold: 24.81, commodities: -3.12 },
  { year: 2022, shares: -17.73, gold: -0.77, commodities: 16.09 },
] as const;
