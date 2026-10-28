import type { Store } from './store/types';

export interface Metrics {
  moments: Record<string, { opened: number; completed: number }>;
  actions: { set: number; confirmed: number; skipped: number };
  /** Confirmed actions / completed moments. The north-star input. */
  actionRate: number;
  payslipGuess?: { count: number; avgGuess: number; avgActual: number; underGuessedShare: number };
  referrals: { clicked: number; opened: number; funded: number; feesLei: number };
}

/** Aggregates only: no per-user data leaves this function. */
export async function computeMetrics(store: Store): Promise<Metrics> {
  const [runs, actions, referrals] = await Promise.all([store.listRuns(), store.listActions(), store.listReferrals()]);

  const moments: Metrics['moments'] = {};
  for (const r of runs) {
    moments[r.momentId] ??= { opened: 0, completed: 0 };
    moments[r.momentId].opened++;
    if (r.state === 'completed') moments[r.momentId].completed++;
  }

  const count = (s: string) => actions.filter((a) => a.status === s).length;
  const completed = runs.filter((r) => r.state === 'completed').length;

  const guessed = runs.filter(
    (r) => r.momentId === 'payslip_explained' && r.guess !== undefined && typeof r.result?.answer === 'number',
  );
  const payslipGuess = guessed.length
    ? {
        count: guessed.length,
        avgGuess: Math.round(guessed.reduce((s, r) => s + (r.guess ?? 0), 0) / guessed.length),
        avgActual: Math.round(guessed.reduce((s, r) => s + Number(r.result?.answer), 0) / guessed.length),
        underGuessedShare: guessed.filter((r) => (r.guess ?? 0) < Number(r.result?.answer)).length / guessed.length,
      }
    : undefined;

  return {
    moments,
    actions: { set: count('set'), confirmed: count('confirmed'), skipped: count('skipped') },
    actionRate: completed ? count('confirmed') / completed : 0,
    payslipGuess,
    referrals: {
      clicked: referrals.length,
      opened: referrals.filter((r) => r.status === 'opened' || r.status === 'funded').length,
      funded: referrals.filter((r) => r.status === 'funded').length,
      feesLei: referrals.reduce((s, r) => s + r.feeLei, 0),
    },
  };
}
