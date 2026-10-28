/**
 * Romanian rules for 2026. Every number here must have a source and a year.
 * Update once a year (1 January) and have the finance reviewer sign off.
 */
export const RULES_2026 = {
  year: 2026,
  /** Pension contribution (CAS), share of gross salary. */
  casRate: 0.25,
  /** Part of gross salary routed to the employee's own Pillar II account (inside CAS). */
  pillar2Rate: 0.0475,
  /** Health contribution (CASS), share of gross salary. */
  cassRate: 0.1,
  /** Income tax on (gross - CAS - CASS - personal deduction). */
  incomeTaxRate: 0.1,
  /** Tax withheld on bank deposit interest. State bonds (Tezaur, Fidelis) are tax-free. */
  depositInterestTaxRate: 0.1,
  /** Gross minimum wage, lei/month. Contribution thresholds for 2026 income use the value on 1 January. */
  minimumWage: [
    { from: '2026-01-01', lei: 4050 },
    { from: '2026-07-01', lei: 4325 },
  ],
  /** Under-35 employees must pick a Pillar II fund within this many months, or they are assigned one. */
  pillar2ChoiceMonths: 4,
} as const;

/**
 * Personal deduction (deducere personala) is NOT applied yet: it depends on gross salary,
 * dependants and age (extra for under-26) under art. 77 of the Fiscal Code.
 * TODO(E1): implement the 2026 table and verify it against 5 real payslips before the demo.
 */
export const PERSONAL_DEDUCTION_IMPLEMENTED = false;
