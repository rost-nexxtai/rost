// MOCK until backend ships GET /api/assets/:id (the rules engine owns the real ranking).
// Neutral by construction: isPartner is copied through to the output, never read for ordering.
import { pct } from '@/lib/format';
import type { Broker, RankedProvider, SavingsProvider } from '../types';

const DEPOSIT_INTEREST_TAX = 0.1;
const round2 = (n: number) => Math.round(n * 100) / 100;
const lei2 = (n: number) => `${new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).format(n)} lei`;

export function netRatePct(p: Pick<SavingsProvider, 'kind' | 'grossRatePct'>): number {
  return round2(p.kind === 'state_bond' ? p.grossRatePct : p.grossRatePct * (1 - DEPOSIT_INTEREST_TAX));
}

/** Net yearly rate after tax, then easier access, then name. */
export function rankSavings(list: SavingsProvider[]): RankedProvider[] {
  return list
    .map((p) => ({ p, net: netRatePct(p) }))
    .sort((a, b) => b.net - a.net || a.p.accessRank - b.p.accessRank || a.p.name.localeCompare(b.p.name, 'ro'))
    .map(({ p, net }, i) => ({
      id: p.id,
      rank: i + 1,
      name: p.name,
      product: p.product,
      headline: `${pct(net, 2)} pe an, după impozit`,
      netRatePct: net,
      accessRank: p.accessRank,
      isPartner: p.isPartner,
      example: p.example,
      offerId: p.offerId,
    }));
}

/** max(commission % × amount, minimum commission) + currency spread % × amount. */
export function brokerCostLei(b: Broker, amountLei = 1000): number {
  return round2(Math.max((b.commissionPct / 100) * amountLei, b.minCommissionLei) + (b.spreadPct / 100) * amountLei);
}

/** Cost of a 1,000 lei order, then name. */
export function rankBrokers(list: Broker[]): RankedProvider[] {
  return list
    .map((b) => ({ b, cost: brokerCostLei(b) }))
    .sort((x, y) => x.cost - y.cost || x.b.name.localeCompare(y.b.name, 'ro'))
    .map(({ b, cost }, i) => ({
      id: b.id,
      rank: i + 1,
      name: b.name,
      product: b.country === 'RO' ? 'Broker din România' : 'Broker din UE',
      headline: `${lei2(cost)} la un ordin de 1.000 lei`,
      costLei: cost,
      isPartner: b.isPartner,
      example: b.example,
    }));
}
