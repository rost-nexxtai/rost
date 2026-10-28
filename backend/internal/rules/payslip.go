package rules

import (
	"errors"
	"math"
)

type PayslipBreakdown struct {
	Gross float64 `json:"gross"`
	// Total pension contribution (CAS, 25% of gross).
	Pension float64 `json:"pension"`
	// Part of CAS that goes into the employee's own Pillar II account.
	Pillar2 float64 `json:"pillar2"`
	// Part of CAS that funds today's pensions and earns the employee pension points.
	PublicPension float64 `json:"publicPension"`
	// Health contribution (CASS, 10%).
	Health            float64 `json:"health"`
	PersonalDeduction float64 `json:"personalDeduction"`
	IncomeTax         float64 `json:"incomeTax"`
	Net               float64 `json:"net"`
	RulesYear         int     `json:"rulesYear"`
}

// Payslip splits a monthly gross salary (employment contract) into contributions, tax and
// take-home pay. All amounts in lei, rounded to the whole leu.
func Payslip(gross, personalDeduction float64) (PayslipBreakdown, error) {
	if math.IsNaN(gross) || math.IsInf(gross, 0) || gross < 0 {
		return PayslipBreakdown{}, errors.New("gross must be a non-negative number")
	}
	r := Rules2026
	pension := Round(gross * r.CASRate)
	pillar2 := Round(gross * r.Pillar2Rate)
	health := Round(gross * r.CASSRate)
	deduction := math.Max(0, personalDeduction)
	taxable := math.Max(0, gross-pension-health-deduction)
	incomeTax := Round(taxable * r.IncomeTaxRate)
	return PayslipBreakdown{
		Gross:             gross,
		Pension:           pension,
		Pillar2:           pillar2,
		PublicPension:     pension - pillar2,
		Health:            health,
		PersonalDeduction: deduction,
		IncomeTax:         incomeTax,
		Net:               gross - pension - health - incomeTax,
		RulesYear:         r.Year,
	}, nil
}
