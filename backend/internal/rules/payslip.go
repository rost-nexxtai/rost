package rules

import (
	"errors"
	"math"
)

type PayslipBreakdown struct {
	Gross float64 `json:"gross"`
	// Untaxed part of a minimum wage (200 lei), left out of contributions and tax; 0 above the minimum wage.
	Untaxed float64 `json:"untaxed"`
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

// Deduction is who the personal deduction is worked out for. Dependants aren't asked yet (0).
type Deduction struct {
	Dependants int
	// up to 26 years old: the extra 15% of the minimum wage
	Young bool
}

// PersonalDeduction is the monthly deduction at the main job (Fiscal Code art. 77), in whole lei.
// Example, 0 dependants, minimum wage 4,325: 865 lei at the minimum wage, 3% of it (130 lei) at
// 6,000 lei (34 steps of 50 lei above it), nothing above 6,325 lei.
func PersonalDeduction(gross float64, d Deduction) float64 {
	r := Rules2026
	if gross <= 0 || gross > r.MinWage+r.DeductionCapAbove {
		return 0
	}
	pct := r.DeductionPct[min(max(d.Dependants, 0), len(r.DeductionPct)-1)]
	if over := gross - r.MinWage; over > 0 {
		pct -= 0.5 * math.Ceil(over/50)
	}
	share := math.Max(0, pct)
	if d.Young {
		share += r.YoungDeductionPct
	}
	return Round(share / 100 * r.MinWage)
}

// Payslip splits a monthly gross salary (employment contract, main job) into contributions, tax and
// take-home pay. All amounts in lei, each rounded to the whole leu like on form D112.
func Payslip(gross float64, d Deduction) (PayslipBreakdown, error) {
	if math.IsNaN(gross) || math.IsInf(gross, 0) || gross < 0 {
		return PayslipBreakdown{}, errors.New("gross must be a non-negative number")
	}
	r := Rules2026
	untaxed := 0.0
	if gross == r.MinWage {
		untaxed = r.MinWageUntaxed
	}
	base := gross - untaxed
	pension := Round(base * r.CASRate)
	pillar2 := Round(base * r.Pillar2Rate)
	health := Round(base * r.CASSRate)
	deduction := PersonalDeduction(gross, d)
	taxable := math.Max(0, base-pension-health-deduction)
	incomeTax := Round(taxable * r.IncomeTaxRate)
	return PayslipBreakdown{
		Gross:             gross,
		Untaxed:           untaxed,
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

// DeductionFor works out who the deduction is for from the quiz's age band: "sub_25" is under 26;
// 25–29 may or may not be, so it gets the base deduction only.
func DeductionFor(ageBand string) Deduction { return Deduction{Young: ageBand == "sub_25"} }
