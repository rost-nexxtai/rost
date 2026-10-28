export interface CategoryShares {
  services: number;
  nonFood: number;
  food: number;
}

export interface PersonalInflation {
  /** Personal 12-month inflation, percent. */
  personalPct: number;
  /** Percentage points each group adds to the personal figure. */
  contributions: CategoryShares;
  /** Shares after normalising to sum to 1. */
  shares: CategoryShares;
}

const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function normalise(s: CategoryShares): CategoryShares {
  const total = s.services + s.nonFood + s.food;
  if (!(total > 0)) throw new Error('spending shares must add up to more than 0');
  return { services: s.services / total, nonFood: s.nonFood / total, food: s.food / total };
}

/**
 * Personal inflation = sum over groups of (your share of spending x that group's 12-month inflation).
 * Groups follow INS's three main groups: services, non-food goods, food goods.
 */
export function personalInflation(shares: CategoryShares, groupsPct: CategoryShares): PersonalInflation {
  const s = normalise(shares);
  const contributions = {
    services: s.services * groupsPct.services,
    nonFood: s.nonFood * groupsPct.nonFood,
    food: s.food * groupsPct.food,
  };
  const personalPct = contributions.services + contributions.nonFood + contributions.food;
  return {
    personalPct: round(personalPct),
    contributions: {
      services: round(contributions.services),
      nonFood: round(contributions.nonFood),
      food: round(contributions.food),
    },
    shares: s,
  };
}

/** What `amount` lei from before buys today, after `inflationPct`. */
export function realValue(amount: number, inflationPct: number): number {
  return Math.round(amount / (1 + inflationPct / 100));
}

/** Purchasing power gained (+) or lost (-) in a year at a net yearly rate, after inflation. */
export function realChange(amount: number, netRatePct: number, inflationPct: number): number {
  return Math.round(amount * ((1 + netRatePct / 100) / (1 + inflationPct / 100) - 1));
}

/** Extra monthly cost if one spending line rises by `shockPct`. A scenario, never a forecast. */
export function scenarioExtra(monthlySpendLei: number, shockPct: number): number {
  return Math.round((monthlySpendLei * shockPct) / 100);
}

/** Emergency buffer target: `months` of expenses, raised by inflation, rounded to 10 lei. */
export function bufferTarget(monthlyExpenses: number, inflationPct: number, months = 3): number {
  return Math.round((monthlyExpenses * months * (1 + inflationPct / 100)) / 10) * 10;
}
