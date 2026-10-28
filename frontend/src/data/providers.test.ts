import { describe, expect, it } from 'vitest';
import type { AssetProvidersResponse } from '@/contract';
import { providerRows } from './providers';

describe('provider rows', () => {
  it('carries the partner label and keeps the backend order', () => {
    const offer = (id: string, isPartner: boolean) => ({ id, rank: 1, provider: id, product: 'p', netRatePct: 6, accessRank: 2, conditions: [], isPartner });
    const savings = { assetId: 'depozit', providerKind: 'savings', amountLei: 10_000, offers: [offer('a', false), offer('b', true)] } as unknown as AssetProvidersResponse;
    expect(providerRows(savings, 'ro').map((r) => [r.id, r.isPartner])).toEqual([
      ['a', false],
      ['b', true],
    ]);

    const broker = { id: 'xtb', rank: 1, name: 'XTB', country: 'PL', regulator: 'KNF', costLei: 0, withholdsTax: false, conditions: [], isPartner: true };
    const brokers = { assetId: 'etf', providerKind: 'brokers', amountLei: 1000, brokers: [broker] } as unknown as AssetProvidersResponse;
    expect(providerRows(brokers, 'en')[0].isPartner).toBe(true);
  });
});
