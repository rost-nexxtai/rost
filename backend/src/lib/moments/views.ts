import { getScenario, latestCpi, offers, type Scenario } from '../reference';
import {
  bufferTarget,
  payslip,
  personalInflation,
  pillar2Deadline,
  rankOffers,
  realChange,
  realValue,
  type Horizon,
  type PayslipBreakdown,
  type PersonalInflation,
} from '../rules';
import type { SpendingProfile, User } from '../store/types';

export interface InflationView {
  period: string;
  headlinePct: number;
  groupsPct: { services: number; nonFood: number; food: number };
  personal: PersonalInflation;
  realSalary?: { gross: number; since?: string; nowWorth: number };
  bufferTarget?: number;
  monthly: SpendingProfile['monthly'];
  /** What 10,000 lei does in a year against YOUR inflation, by kind of place (no provider names). */
  savings: { amountLei: number; rows: { label: string; netRatePct: number; realChangeLei: number }[]; exampleRates: boolean };
  source: { label: string; url: string };
}

const SAVINGS_AMOUNT = 10_000;

function savingsComparison(inflationPct: number): InflationView['savings'] {
  const best = (horizon: Horizon, label: string) => {
    const top = rankOffers(offers(), { horizon, amountLei: SAVINGS_AMOUNT })[0];
    return top ? { label, netRatePct: top.netRatePct, realChangeLei: realChange(SAVINGS_AMOUNT, top.netRatePct, inflationPct) } : undefined;
  };
  const rows = [
    { label: 'Current account', netRatePct: 0, realChangeLei: realChange(SAVINGS_AMOUNT, 0, inflationPct) },
    best('any_time', 'Best instant-access savings'),
    best('one_to_two_years', 'Best 1–2 year option'),
  ].filter((r): r is NonNullable<typeof r> => r !== undefined);
  return { amountLei: SAVINGS_AMOUNT, rows, exampleRates: offers().some((o) => o.example) };
}

export interface MomentView {
  payslip?: PayslipBreakdown & { pillar2Deadline?: string };
  inflation?: InflationView;
  scenario?: Scenario & { monthlySpend: number };
  /** The correct answer for a predict step, keyed by the step's `answer` field. */
  answers: Record<string, number>;
  /** Values for {{placeholders}} in questions and cards. */
  vars: Record<string, string | number | undefined>;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** Builds the inflation view from a spending profile. Used by the app and by the partner embed. */
export function inflationView(input: {
  spending: SpendingProfile;
  grossMonthly?: number;
  lastRaiseDate?: string;
  monthlyExpenses?: number;
}): InflationView {
  const cpi = latestCpi();
  const personal = personalInflation(input.spending.shares, cpi.groupsPct);
  return {
    period: cpi.period,
    headlinePct: cpi.headlinePct,
    groupsPct: cpi.groupsPct,
    personal,
    // Approximation: uses the 12-month personal inflation for "since your last raise".
    realSalary: input.grossMonthly
      ? { gross: input.grossMonthly, since: input.lastRaiseDate, nowWorth: realValue(input.grossMonthly, personal.personalPct) }
      : undefined,
    bufferTarget: input.monthlyExpenses ? bufferTarget(input.monthlyExpenses, personal.personalPct) : undefined,
    monthly: input.spending.monthly,
    savings: savingsComparison(personal.personalPct),
    source: { label: cpi.source, url: cpi.url },
  };
}

export function buildView(user: User, eventPayload: Record<string, unknown> = {}): MomentView {
  const view: MomentView = { answers: {}, vars: {} };
  const cpi = latestCpi();
  view.vars.headline = cpi.headlinePct;

  if (user.grossMonthly !== undefined) {
    const p = payslip(user.grossMonthly);
    const deadline = user.hireDate ? pillar2Deadline(user.hireDate) : undefined;
    view.payslip = { ...p, pillar2Deadline: deadline };
    view.answers.pension = p.pension;
    view.vars.gross = fmt(p.gross);
    view.vars.pillar2 = fmt(p.pillar2);
    view.vars.pillar2Line = deadline
      ? `You were hired on ${user.hireDate}, so you can choose your own fund until ${deadline}.`
      : '';
  }

  if (user.spending) {
    const iv = inflationView({
      spending: user.spending,
      grossMonthly: user.grossMonthly,
      lastRaiseDate: user.lastRaiseDate,
      monthlyExpenses: user.monthlyExpenses,
    });
    view.inflation = iv;
    view.answers.personalPct = iv.personal.personalPct;
    if (iv.bufferTarget !== undefined) view.vars.bufferTarget = fmt(iv.bufferTarget);

    const scenario = getScenario(eventPayload.scenarioId) ?? getScenario('fuel-shortage');
    if (scenario) {
      view.scenario = { ...scenario, monthlySpend: user.spending.monthly[scenario.spendLine] ?? 0 };
    }
  }
  return view;
}
