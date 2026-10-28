import macro from '../../data/seed/macro.json';
import offersSeed from '../../data/seed/offers.json';
import partnersSeed from '../../data/seed/partners.json';
import scenariosSeed from '../../data/seed/scenarios.json';
import payslipExplained from '../../data/moments/payslip_explained.json';
import personalInflationMoment from '../../data/moments/personal_inflation.json';
import whatifShock from '../../data/moments/whatif_shock.json';
import type { MomentDefinition } from './moments/types';
import type { CategoryShares } from './rules/inflation';
import type { Offer } from './rules/ranking';

/** Reference data: versioned JSON, reviewed like code. */

export interface CpiRelease {
  period: string;
  headlinePct: number;
  groupsPct: CategoryShares;
  source: string;
  url: string;
  publishedAt: string;
}

export interface Partner {
  id: string;
  kind: 'bank' | 'broker' | 'employer';
  displayName: string;
  theme: { primary: string; ground: string; ink: string } | null;
  secretEnv: string | null;
  feePerFundedLei: number;
  feeIsExample?: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  context: string;
  spendLine: 'fuel' | 'utilities' | 'food';
  defaultShockPct: number;
  minShockPct: number;
  maxShockPct: number;
  status: 'draft' | 'approved';
  reviewedBy: string;
}

export const offers = (): Offer[] => offersSeed.offers as Offer[];
export const partners = (): Partner[] => partnersSeed.partners as Partner[];
export const getPartner = (id: string | null | undefined) => partners().find((p) => p.id === id);

export function latestCpi(): CpiRelease {
  const sorted = [...(macro.cpi as CpiRelease[])].sort((a, b) => b.period.localeCompare(a.period));
  return sorted[0];
}

/** Only approved scenarios can reach users. */
export const scenarios = (): Scenario[] => (scenariosSeed.scenarios as Scenario[]).filter((s) => s.status === 'approved');
export const getScenario = (id: unknown) => scenarios().find((s) => s.id === id);

export const momentDefs = (): MomentDefinition[] =>
  [payslipExplained, personalInflationMoment, whatifShock] as MomentDefinition[];
export const getMomentDef = (id: string) => momentDefs().find((d) => d.id === id);
