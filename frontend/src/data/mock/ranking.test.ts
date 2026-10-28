import { describe, expect, it } from 'vitest';
import { BROKERS } from '../fixtures/brokers';
import { SAVINGS } from '../fixtures/providers';
import { netRatePct, rankBrokers, rankSavings } from './ranking';

describe('net rate after tax', () => {
  it('takes 10% of deposit interest and leaves state bonds untaxed', () => {
    expect(netRatePct({ kind: 'deposit', grossRatePct: 5.25 })).toBe(4.73);
    expect(netRatePct({ kind: 'state_bond', grossRatePct: 6.5 })).toBe(6.5);
  });
});

describe('neutral ranking', () => {
  it('gives the same savings order whether or not a provider is a partner', () => {
    const flipped = SAVINGS.map((p) => ({ ...p, isPartner: !p.isPartner }));
    expect(rankSavings(flipped).map((r) => r.id)).toEqual(rankSavings(SAVINGS).map((r) => r.id));
  });

  it('ranks brokers by the cost of a 1,000 lei order, partners ignored', () => {
    expect(rankBrokers(BROKERS).map((b) => b.id)).toEqual(['broker-b', 'broker-a', 'broker-c']);
    expect(rankBrokers(BROKERS.map((b) => ({ ...b, isPartner: !b.isPartner }))).map((b) => b.id)).toEqual(['broker-b', 'broker-a', 'broker-c']);
  });
});
