// Package rules holds the pure money rules for 2026: payslip, inflation, ranking and dates.
// Every number in Rules2026 must have a source and a year; update it once a year (1 January)
// and have the finance reviewer sign off.
package rules

import "math"

var Rules2026 = struct {
	Year int
	// Pension contribution (CAS), share of gross salary.
	CASRate float64
	// Part of gross salary routed to the employee's own Pillar II account (inside CAS).
	Pillar2Rate float64
	// Health contribution (CASS), share of gross salary.
	CASSRate float64
	// Income tax on (gross - CAS - CASS - personal deduction).
	IncomeTaxRate float64
	// Tax withheld on bank deposit interest for Romanian residents: still 10% in 2026 (Fiscal Code
	// art. 96). Law 141/2025 raised dividends to 16%, not interest. State bonds (Tezaur, Fidelis) are tax-free.
	DepositInterestTaxRate float64
	// Under-35 employees must pick a Pillar II fund within this many months, or they are assigned one.
	Pillar2ChoiceMonths int
	// Gross minimum wage: 4,325 lei from 1 July 2026 (HG 146/2026); it was 4,050 lei before.
	MinWage float64
	// Untaxed part of a full-time minimum wage at the main job: 200 lei from July 2026 (OUG 89/2025), 300 lei before.
	MinWageUntaxed float64
	// Personal deduction (Fiscal Code art. 77): a share of the minimum wage by dependants (0, 1, 2, 3, 4+),
	// down 0.5 points for each 50 lei started above the minimum wage, nothing above minimum wage + 2,000 lei.
	DeductionPct      [5]float64
	DeductionCapAbove float64
	// Extra deduction for employees up to 26, as a share of the minimum wage, under the same cap.
	YoungDeductionPct float64
}{
	Year:                   2026,
	CASRate:                0.25,
	Pillar2Rate:            0.0475,
	CASSRate:               0.1,
	IncomeTaxRate:          0.1,
	DepositInterestTaxRate: 0.1,
	Pillar2ChoiceMonths:    4,
	MinWage:                4325,
	MinWageUntaxed:         200,
	DeductionPct:           [5]float64{20, 25, 30, 35, 45},
	DeductionCapAbove:      2000,
	YoungDeductionPct:      15,
}

// Round rounds like JavaScript's Math.round (halves go up), so figures match the old tests.
func Round(x float64) float64 { return math.Floor(x + 0.5) }

// RoundTo rounds to d decimals, like Math.round(x * 10^d) / 10^d.
func RoundTo(x float64, d int) float64 {
	p := math.Pow(10, float64(d))
	return Round(x*p) / p
}
