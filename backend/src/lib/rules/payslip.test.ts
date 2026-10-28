import { describe, expect, it } from 'vitest';
import { payslip } from './payslip';

// Hand-checked cases (no personal deduction). Add real payslips here before the demo.
const cases = [
  { gross: 6000, pension: 1500, pillar2: 285, health: 600, incomeTax: 390, net: 3510 },
  { gross: 4325, pension: 1081, pillar2: 205, health: 433, incomeTax: 281, net: 2530 },
  { gross: 9000, pension: 2250, pillar2: 428, health: 900, incomeTax: 585, net: 5265 },
  { gross: 12000, pension: 3000, pillar2: 570, health: 1200, incomeTax: 780, net: 7020 },
  { gross: 0, pension: 0, pillar2: 0, health: 0, incomeTax: 0, net: 0 },
];

describe('payslip (2026, no personal deduction)', () => {
  it.each(cases)('splits $gross lei gross', (c) => {
    const p = payslip(c.gross);
    expect(p.pension).toBe(c.pension);
    expect(p.pillar2).toBe(c.pillar2);
    expect(p.health).toBe(c.health);
    expect(p.incomeTax).toBe(c.incomeTax);
    expect(p.net).toBe(c.net);
    expect(p.publicPension + p.pillar2).toBe(p.pension);
    expect(p.pension + p.health + p.incomeTax + p.net).toBe(c.gross);
  });

  it('applies a personal deduction to the income-tax base only', () => {
    const p = payslip(6000, { personalDeduction: 300 });
    expect(p.incomeTax).toBe(360);
    expect(p.pension).toBe(1500);
    expect(p.net).toBe(3540);
  });

  it('rejects negative gross', () => {
    expect(() => payslip(-1)).toThrow();
  });
});
