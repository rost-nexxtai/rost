import { describe, expect, it } from 'vitest';
import { bufferTarget, personalInflation, realChange, realValue, scenarioExtra } from './inflation';

// INS, September 2026: headline 6.61%, services 11.12%, non-food 7.06%, food 3.00%.
const sept2026 = { services: 11.12, nonFood: 7.06, food: 3.0 };

describe('personal inflation', () => {
  it("computes Maria's 8.48% from her spending mix", () => {
    const r = personalInflation({ services: 0.55, nonFood: 0.25, food: 0.2 }, sept2026);
    expect(r.personalPct).toBe(8.48);
    expect(r.contributions.services).toBe(6.12);
    expect(r.contributions.nonFood).toBe(1.77);
    expect(r.contributions.food).toBe(0.6);
  });

  it('normalises shares that do not add up to 1', () => {
    const a = personalInflation({ services: 55, nonFood: 25, food: 20 }, sept2026);
    expect(a.personalPct).toBe(8.48);
  });

  it('rejects an empty mix', () => {
    expect(() => personalInflation({ services: 0, nonFood: 0, food: 0 }, sept2026)).toThrow();
  });
});

describe('real values', () => {
  it('real salary: 6,000 lei a year ago buys what 5,531 lei did', () => {
    expect(realValue(6000, 8.48)).toBe(5531);
  });

  it('a year of savings on 10,000 lei at 6.61% inflation', () => {
    expect(realChange(10000, 0, 6.61)).toBe(-620); // cash
    expect(realChange(10000, 4.05, 6.61)).toBe(-240); // 4.5% deposit after 10% tax
    expect(realChange(10000, 7.6, 6.61)).toBe(93); // tax-free state bond
  });
});

describe('scenarios and buffer', () => {
  it('fuel +20% on 400 lei a month is +80 lei', () => {
    expect(scenarioExtra(400, 20)).toBe(80);
  });

  it('buffer target: 3 months of 2,500 lei raised by 8.48%, rounded to 10 lei', () => {
    expect(bufferTarget(2500, 8.48)).toBe(8140);
  });
});
