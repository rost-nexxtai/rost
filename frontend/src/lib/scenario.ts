import type { MomentView } from '@backend/contract';
import type { ScenarioSliderProps } from '@/components/moments/ScenarioSlider';

/**
 * Extra lei a month for a shock on one spending line. Mirrors scenarioExtra() in
 * backend/src/lib/rules/inflation.ts so the slider can move without a round trip; keep them in sync.
 */
export function scenarioExtra(monthlySpendLei: number, shockPct: number): number {
  return Math.round((monthlySpendLei * shockPct) / 100);
}

/** Maps a reviewed scenario (backend/data/seed/scenarios.json) to slider props. Safe on server and client. */
export function scenarioProps(s: NonNullable<MomentView['scenario']>): ScenarioSliderProps {
  return {
    title: s.title,
    context: s.context,
    spendLine: s.spendLine,
    monthlySpend: s.monthlySpend,
    minPct: s.minShockPct,
    maxPct: s.maxShockPct,
    defaultPct: s.defaultShockPct,
    reviewedBy: s.reviewedBy,
  };
}
