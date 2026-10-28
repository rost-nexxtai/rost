import { describe, expect, it } from 'vitest';
import offersSeed from '../../../data/seed/offers.json';
import { netRatePct, rankOffers, type Offer } from './ranking';

const offers = offersSeed.offers as Offer[];

describe('net rate', () => {
  it('takes 10% tax off deposit interest, none off state bonds', () => {
    expect(netRatePct({ kind: 'deposit', grossRatePct: 5.25 })).toBe(4.73);
    expect(netRatePct({ kind: 'state_bond', grossRatePct: 7.6 })).toBe(7.6);
  });
});

describe('neutral ranking', () => {
  it('ranks 1-2 year options for 5,000 lei by net return', () => {
    const r = rankOffers(offers, { horizon: 'one_to_two_years', amountLei: 5000 });
    expect(r.map((o) => o.id)).toEqual(['fidelis-2y-lei', 'tezaur-1y', 'bank-a-12m', 'bank-b-12m', 'bank-c-12m']);
    expect(r[0].gainLei).toBe(380);
    expect(r[2].gainLei).toBe(237);
  });

  it('filters by horizon and minimum amount', () => {
    expect(rankOffers(offers, { horizon: 'any_time', amountLei: 1000 }).map((o) => o.id)).toEqual([
      'bank-d-savings',
      'bank-b-savings',
    ]);
    expect(rankOffers(offers, { horizon: 'one_to_two_years', amountLei: 1000 }).map((o) => o.id)).not.toContain(
      'fidelis-2y-lei',
    );
  });

  it('gives the same order whoever is a partner', () => {
    const base = rankOffers(offers, { horizon: 'one_to_two_years', amountLei: 5000 }).map((o) => o.id);
    const flipped = offers.map((o) => ({ ...o, partnerId: o.partnerId ? null : 'someone' }));
    const allPartners = offers.map((o) => ({ ...o, partnerId: 'someone' }));
    expect(rankOffers(flipped, { horizon: 'one_to_two_years', amountLei: 5000 }).map((o) => o.id)).toEqual(base);
    expect(rankOffers(allPartners, { horizon: 'one_to_two_years', amountLei: 5000 }).map((o) => o.id)).toEqual(base);
  });

  it('breaks ties by easier access, then name', () => {
    const tie: Offer[] = [
      { ...offers[3], id: 'locked', provider: 'A', accessRank: 3, grossRatePct: 5 },
      { ...offers[3], id: 'flexible', provider: 'Z', accessRank: 2, grossRatePct: 5 },
    ];
    expect(rankOffers(tie, { horizon: 'one_to_two_years', amountLei: 5000 }).map((o) => o.id)).toEqual([
      'flexible',
      'locked',
    ]);
  });
});
