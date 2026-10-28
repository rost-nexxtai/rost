import type { MomentView } from '@/lib/moments/views';
import type { ScenarioSliderProps } from './ScenarioSlider';

/** Maps a reviewed scenario (data/seed/scenarios.json) to slider props. Safe on server and client. */
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
