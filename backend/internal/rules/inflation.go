package rules

import (
	"errors"

	"rost/backend/internal/domain"
)

type PersonalInflation struct {
	// Personal 12-month inflation, percent.
	PersonalPct float64 `json:"personalPct"`
	// Percentage points each group adds to the personal figure.
	Contributions domain.CategoryShares `json:"contributions"`
	// Shares after normalising to sum to 1.
	Shares domain.CategoryShares `json:"shares"`
}

func normalise(s domain.CategoryShares) (domain.CategoryShares, error) {
	total := s.Services + s.NonFood + s.Food
	if !(total > 0) {
		return domain.CategoryShares{}, errors.New("spending shares must add up to more than 0")
	}
	return domain.CategoryShares{Services: s.Services / total, NonFood: s.NonFood / total, Food: s.Food / total}, nil
}

// PersonalInflationFor is the sum over groups of (your share of spending x that group's 12-month
// inflation). Groups follow INS's three main groups: services, non-food goods, food goods.
func PersonalInflationFor(shares, groupsPct domain.CategoryShares) (PersonalInflation, error) {
	s, err := normalise(shares)
	if err != nil {
		return PersonalInflation{}, err
	}
	c := domain.CategoryShares{
		Services: s.Services * groupsPct.Services,
		NonFood:  s.NonFood * groupsPct.NonFood,
		Food:     s.Food * groupsPct.Food,
	}
	return PersonalInflation{
		PersonalPct:   RoundTo(c.Services+c.NonFood+c.Food, 2),
		Contributions: domain.CategoryShares{Services: RoundTo(c.Services, 2), NonFood: RoundTo(c.NonFood, 2), Food: RoundTo(c.Food, 2)},
		Shares:        s,
	}, nil
}

// RealValue is what amount lei from before buys today, after inflationPct.
func RealValue(amount, inflationPct float64) float64 {
	return Round(amount / (1 + inflationPct/100))
}

// RealChange is purchasing power gained (+) or lost (-) in a year at a net yearly rate, after inflation.
func RealChange(amount, netRatePct, inflationPct float64) float64 {
	return Round(amount * ((1+netRatePct/100)/(1+inflationPct/100) - 1))
}

// ScenarioExtra is the extra monthly cost if one spending line rises by shockPct. A scenario, never a forecast.
func ScenarioExtra(monthlySpendLei, shockPct float64) float64 {
	return Round(monthlySpendLei * shockPct / 100)
}

// BufferTarget is an emergency buffer of months of expenses, raised by inflation, rounded to 10 lei.
func BufferTarget(monthlyExpenses, inflationPct float64, months float64) float64 {
	return Round(monthlyExpenses*months*(1+inflationPct/100)/10) * 10
}
