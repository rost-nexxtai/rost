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
	// Tax withheld on bank deposit interest. State bonds (Tezaur, Fidelis) are tax-free.
	DepositInterestTaxRate float64
	// Under-35 employees must pick a Pillar II fund within this many months, or they are assigned one.
	Pillar2ChoiceMonths int
}{
	Year:                   2026,
	CASRate:                0.25,
	Pillar2Rate:            0.0475,
	CASSRate:               0.1,
	IncomeTaxRate:          0.1,
	DepositInterestTaxRate: 0.1,
	Pillar2ChoiceMonths:    4,
}

// PersonalDeductionImplemented is false: the deduction (art. 77 of the Fiscal Code) depends on gross
// salary, dependants and age. TODO: implement the 2026 table and verify it against real payslips.
const PersonalDeductionImplemented = false

// Round rounds like JavaScript's Math.round (halves go up), so figures match the old tests.
func Round(x float64) float64 { return math.Floor(x + 0.5) }

// RoundTo rounds to d decimals, like Math.round(x * 10^d) / 10^d.
func RoundTo(x float64, d int) float64 {
	p := math.Pow(10, float64(d))
	return Round(x*p) / p
}
