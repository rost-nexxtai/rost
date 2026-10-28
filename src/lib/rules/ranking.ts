import { RULES_2026 } from './constants';

export type OfferKind = 'deposit' | 'state_bond';
export type Horizon = 'any_time' | 'one_to_two_years' | 'later';

export interface Offer {
  id: string;
  provider: string;
  product: string;
  kind: OfferKind;
  grossRatePct: number;
  /** 0 = instant access. */
  termMonths: number;
  /** 1 = take it out any time, 2 = lose interest if you break it, 3 = locked until maturity (or sold at market price). */
  accessRank: 1 | 2 | 3;
  minAmountLei: number;
  conditions: string[];
  partnerId: string | null;
  example?: boolean;
  updatedAt: string;
}

export interface RankedOffer extends Offer {
  rank: number;
  netRatePct: number;
  gainLei: number;
  isPartner: boolean;
}

/** Net yearly rate after tax: deposits lose 10% of interest to tax, state bonds are tax-free. */
export function netRatePct(o: Pick<Offer, 'kind' | 'grossRatePct'>): number {
  const net = o.kind === 'deposit' ? o.grossRatePct * (1 - RULES_2026.depositInterestTaxRate) : o.grossRatePct;
  return Math.round(net * 100) / 100;
}

export function matchesHorizon(o: Offer, h: Horizon): boolean {
  if (h === 'any_time') return o.termMonths === 0;
  if (h === 'one_to_two_years') return o.termMonths > 0 && o.termMonths <= 24;
  return o.termMonths > 24;
}

/**
 * Neutral ranking. Public formula: net yearly return after tax, then easier access, then name.
 * Partner status is deliberately NOT an input; a test proves it.
 */
export function rankOffers(offers: Offer[], opts: { horizon: Horizon; amountLei: number }): RankedOffer[] {
  return offers
    .filter((o) => matchesHorizon(o, opts.horizon) && o.minAmountLei <= opts.amountLei)
    .map((o) => ({ o, net: netRatePct(o) }))
    .sort(
      (a, b) =>
        b.net - a.net ||
        a.o.accessRank - b.o.accessRank ||
        `${a.o.provider} ${a.o.product}`.localeCompare(`${b.o.provider} ${b.o.product}`),
    )
    .map(({ o, net }, i) => ({
      ...o,
      rank: i + 1,
      netRatePct: net,
      gainLei: Math.round((opts.amountLei * net) / 100),
      isPartner: o.partnerId !== null,
    }));
}
