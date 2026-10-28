import { RULES_2026 } from './constants';

export interface PayslipBreakdown {
  gross: number;
  /** Total pension contribution (CAS, 25% of gross). */
  pension: number;
  /** Part of CAS that goes into the employee's own Pillar II account. */
  pillar2: number;
  /** Part of CAS that funds today's pensions and earns the employee pension points. */
  publicPension: number;
  /** Health contribution (CASS, 10%). */
  health: number;
  personalDeduction: number;
  incomeTax: number;
  net: number;
  rulesYear: number;
}

const leu = (x: number) => Math.round(x);

/**
 * Splits a monthly gross salary (employment contract) into contributions, tax and take-home pay.
 * All amounts in lei, rounded to the whole leu.
 */
export function payslip(gross: number, opts: { personalDeduction?: number } = {}): PayslipBreakdown {
  if (!Number.isFinite(gross) || gross < 0) throw new Error('gross must be a non-negative number');
  const r = RULES_2026;
  const pension = leu(gross * r.casRate);
  const pillar2 = leu(gross * r.pillar2Rate);
  const health = leu(gross * r.cassRate);
  const personalDeduction = Math.max(0, opts.personalDeduction ?? 0);
  const taxable = Math.max(0, gross - pension - health - personalDeduction);
  const incomeTax = leu(taxable * r.incomeTaxRate);
  return {
    gross,
    pension,
    pillar2,
    publicPension: pension - pillar2,
    health,
    personalDeduction,
    incomeTax,
    net: gross - pension - health - incomeTax,
    rulesYear: r.year,
  };
}
