import { describe, expect, it } from 'vitest';
import { needsAmount, savingsLossLei, spendImpactLei } from './stiri';

describe('Știri impact on Maria', () => {
  it('turns a price shock into lei a month', () => {
    expect(spendImpactLei(400, 8)).toBe(32);
    expect(spendImpactLei(150, 20)).toBe(30);
    expect(spendImpactLei(0, 25)).toBe(0);
  });

  it('shows what inflation takes from savings in a year, and how much less in Tezaur', () => {
    expect(savingsLossLei(2500, 8.48)).toBe(-195);
    expect(savingsLossLei(2500, 8.48, 6.5)).toBe(-46);
  });
});

describe('asking for an amount', () => {
  const money = { fuelLei: 0, electricityLei: 150, savedLei: 0, inflationPct: 6.61 };

  it('asks only for lines the user has not answered yet', () => {
    expect(needsAmount(money, 'fuelLei')).toBe(true);
    expect(needsAmount(money, 'electricityLei')).toBe(false);
  });

  it('treats an answered 0 ("I have no car") as an answer, not a question', () => {
    expect(needsAmount({ ...money, known: ['fuelLei'] }, 'fuelLei')).toBe(false);
  });
});
