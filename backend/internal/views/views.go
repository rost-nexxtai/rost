// Package views computes the numbers a moment shows a particular user.
package views

import (
	"strconv"
	"strings"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
)

type SavingsRow struct {
	Label         string  `json:"label"`
	NetRatePct    float64 `json:"netRatePct"`
	RealChangeLei float64 `json:"realChangeLei"`
}

type RealSalary struct {
	Gross    float64 `json:"gross"`
	Since    *string `json:"since,omitempty"`
	NowWorth float64 `json:"nowWorth"`
}

type Source struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type InflationView struct {
	Period       string                  `json:"period"`
	HeadlinePct  float64                 `json:"headlinePct"`
	GroupsPct    domain.CategoryShares   `json:"groupsPct"`
	Personal     rules.PersonalInflation `json:"personal"`
	RealSalary   *RealSalary             `json:"realSalary,omitempty"`
	BufferTarget *float64                `json:"bufferTarget,omitempty"`
	Monthly      domain.MonthlyLines     `json:"monthly"`
	// What 10,000 lei does in a year against YOUR inflation, by kind of place (no provider names).
	Savings struct {
		AmountLei    float64      `json:"amountLei"`
		Rows         []SavingsRow `json:"rows"`
		ExampleRates bool         `json:"exampleRates"`
	} `json:"savings"`
	Source Source `json:"source"`
}

type PayslipView struct {
	rules.PayslipBreakdown
	Pillar2Deadline *string `json:"pillar2Deadline,omitempty"`
}

type ScenarioView struct {
	reference.Scenario
	MonthlySpend float64 `json:"monthlySpend"`
}

type MomentView struct {
	Payslip   *PayslipView   `json:"payslip,omitempty"`
	Inflation *InflationView `json:"inflation,omitempty"`
	Scenario  *ScenarioView  `json:"scenario,omitempty"`
	// The correct answer for a predict step, keyed by the step's answer field.
	Answers map[string]float64 `json:"answers"`
	// Values for {{placeholders}} in questions and cards.
	Vars map[string]any `json:"vars"`
}

const savingsAmount = 10_000

func savingsComparison(v *InflationView, inflationPct float64) {
	v.Savings.AmountLei = savingsAmount
	v.Savings.Rows = []SavingsRow{{"Current account", 0, rules.RealChange(savingsAmount, 0, inflationPct)}}
	for _, b := range []struct {
		h     rules.Horizon
		label string
	}{{rules.AnyTime, "Best instant-access savings"}, {rules.OneToTwoYears, "Best 1–2 year option"}} {
		if ranked := rules.RankOffers(reference.Offers(), b.h, savingsAmount); len(ranked) > 0 {
			top := ranked[0]
			v.Savings.Rows = append(v.Savings.Rows, SavingsRow{b.label, top.NetRatePct, rules.RealChange(savingsAmount, top.NetRatePct, inflationPct)})
		}
	}
	for _, o := range reference.Offers() {
		if o.Example != nil && *o.Example {
			v.Savings.ExampleRates = true
		}
	}
}

// InflationInput is what the inflation view needs. Used by the app and by the partner embed.
type InflationInput struct {
	Spending        domain.SpendingProfile
	GrossMonthly    *float64
	LastRaiseDate   *string
	MonthlyExpenses *float64
}

func Inflation(in InflationInput) (*InflationView, error) {
	cpi := reference.LatestCPI()
	personal, err := rules.PersonalInflationFor(in.Spending.Shares, cpi.GroupsPct)
	if err != nil {
		return nil, err
	}
	v := &InflationView{
		Period:      cpi.Period,
		HeadlinePct: cpi.HeadlinePct,
		GroupsPct:   cpi.GroupsPct,
		Personal:    personal,
		Monthly:     in.Spending.Monthly,
		Source:      Source{cpi.Source, cpi.URL},
	}
	// Approximation: uses the 12-month personal inflation for "since your last raise".
	if in.GrossMonthly != nil && *in.GrossMonthly != 0 {
		v.RealSalary = &RealSalary{*in.GrossMonthly, in.LastRaiseDate, rules.RealValue(*in.GrossMonthly, personal.PersonalPct)}
	}
	if in.MonthlyExpenses != nil && *in.MonthlyExpenses != 0 {
		t := rules.BufferTarget(*in.MonthlyExpenses, personal.PersonalPct, 3)
		v.BufferTarget = &t
	}
	savingsComparison(v, personal.PersonalPct)
	return v, nil
}

// FormatEN formats a number like JavaScript's toLocaleString('en-US'): 6000 -> "6,000".
func FormatEN(n float64) string {
	s := strconv.FormatFloat(rules.RoundTo(n, 3), 'f', -1, 64)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	whole, frac, _ := strings.Cut(s, ".")
	var b strings.Builder
	for i, c := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(c)
	}
	out := b.String()
	if frac != "" {
		out += "." + frac
	}
	if neg {
		out = "-" + out
	}
	return out
}

// Build is the view for one user, given the payload of the event that opened the moment.
func Build(u domain.User, payload map[string]any) (MomentView, error) {
	v := MomentView{Answers: map[string]float64{}, Vars: map[string]any{}}
	cpi := reference.LatestCPI()
	v.Vars["headline"] = cpi.HeadlinePct

	if u.GrossMonthly != nil {
		p, err := rules.Payslip(*u.GrossMonthly, 0)
		if err != nil {
			return v, err
		}
		pv := &PayslipView{PayslipBreakdown: p}
		v.Vars["pillar2Line"] = ""
		if u.HireDate != nil {
			deadline := rules.Pillar2Deadline(*u.HireDate)
			pv.Pillar2Deadline = &deadline
			v.Vars["pillar2Line"] = "You were hired on " + *u.HireDate + ", so you can choose your own fund until " + deadline + "."
		}
		v.Payslip = pv
		v.Answers["pension"] = p.Pension
		v.Vars["gross"] = FormatEN(p.Gross)
		v.Vars["pillar2"] = FormatEN(p.Pillar2)
	}

	if u.Spending != nil {
		iv, err := Inflation(InflationInput{*u.Spending, u.GrossMonthly, u.LastRaiseDate, u.MonthlyExpenses})
		if err != nil {
			return v, err
		}
		v.Inflation = iv
		v.Answers["personalPct"] = iv.Personal.PersonalPct
		if iv.BufferTarget != nil {
			v.Vars["bufferTarget"] = FormatEN(*iv.BufferTarget)
		}
		s, ok := reference.GetScenario(payload["scenarioId"])
		if !ok {
			s, ok = reference.GetScenario("fuel-shortage")
		}
		if ok {
			v.Scenario = &ScenarioView{s, u.Spending.Monthly.Line(s.SpendLine)}
		}
	}
	return v, nil
}
