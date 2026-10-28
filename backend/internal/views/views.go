// Package views computes the numbers a moment shows a particular user.
package views

import (
	"strconv"
	"strings"
	"time"

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

// savingsLabels are the three rows of the savings comparison, in each language.
var savingsLabels = map[reference.Lang][3]string{
	reference.RO: {"Cont curent", "Cel mai bun cont de economii", "Cea mai bună opțiune pe 1–2 ani"},
	reference.EN: {"Current account", "Best savings account", "Best 1–2 year option"},
}

func savingsComparison(v *InflationView, inflationPct float64, lang reference.Lang) {
	labels := savingsLabels[reference.ParseLang(string(lang))]
	v.Savings.AmountLei = savingsAmount
	v.Savings.Rows = []SavingsRow{{labels[0], 0, rules.RealChange(savingsAmount, 0, inflationPct)}}
	for _, b := range []struct {
		h     rules.Horizon
		label string
	}{{rules.AnyTime, labels[1]}, {rules.OneToTwoYears, labels[2]}} {
		if ranked := rules.RankOffers(reference.Offers(lang), b.h, savingsAmount); len(ranked) > 0 {
			top := ranked[0]
			v.Savings.Rows = append(v.Savings.Rows, SavingsRow{b.label, top.NetRatePct, rules.RealChange(savingsAmount, top.NetRatePct, inflationPct)})
		}
	}
	for _, o := range reference.Offers(lang) {
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

func Inflation(in InflationInput, lang reference.Lang) (*InflationView, error) {
	cpi := reference.LatestCPI(lang)
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
	savingsComparison(v, personal.PersonalPct, lang)
	return v, nil
}

// Format writes a number the way the language does: 6000 -> "6.000" in Romanian, "6,000" in English.
func Format(n float64, lang reference.Lang) string {
	if lang == reference.EN {
		return formatWith(n, ',', '.')
	}
	return formatWith(n, '.', ',')
}

// FormatRO formats a number the Romanian way: 6000 -> "6.000", 8.5 -> "8,5".
func FormatRO(n float64) string { return formatWith(n, '.', ',') }

func formatWith(n float64, group, decimal byte) string {
	s := strconv.FormatFloat(rules.RoundTo(n, 3), 'f', -1, 64)
	neg := strings.HasPrefix(s, "-")
	s = strings.TrimPrefix(s, "-")
	whole, frac, _ := strings.Cut(s, ".")
	var b strings.Builder
	for i, c := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(group)
		}
		b.WriteRune(c)
	}
	out := b.String()
	if frac != "" {
		out += string(decimal) + frac
	}
	if neg {
		out = "-" + out
	}
	return out
}

// Build is the view for one user, given the payload of the event that opened the moment.
// Text and number formats follow lang; the numbers themselves don't depend on it.
func Build(u domain.User, payload map[string]any, lang reference.Lang) (MomentView, error) {
	v := MomentView{Answers: map[string]float64{}, Vars: map[string]any{}}
	cpi := reference.LatestCPI(lang)
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
			v.Vars["pillar2Line"] = pillar2Line(*u.HireDate, deadline, lang)
		}
		v.Payslip = pv
		v.Answers["pension"] = p.Pension
		v.Vars["gross"] = Format(p.Gross, lang)
		v.Vars["pillar2"] = Format(p.Pillar2, lang)
	}

	if u.Spending != nil {
		iv, err := Inflation(InflationInput{*u.Spending, u.GrossMonthly, u.LastRaiseDate, u.MonthlyExpenses}, lang)
		if err != nil {
			return v, err
		}
		v.Inflation = iv
		v.Answers["personalPct"] = iv.Personal.PersonalPct
		if iv.BufferTarget != nil {
			v.Vars["bufferTarget"] = Format(*iv.BufferTarget, lang)
		}
		s, ok := reference.GetScenario(payload["scenarioId"], lang)
		if !ok {
			s, ok = reference.GetScenario("fuel-shortage", lang)
		}
		if ok {
			v.Scenario = &ScenarioView{s, u.Spending.Monthly.Line(s.SpendLine)}
		}
	}
	return v, nil
}

var monthsRO = [...]string{"ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"}

// DateRO writes an ISO date the Romanian way: "2026-12-31" -> "31 decembrie 2026".
func DateRO(iso string) string { return Date(iso, reference.RO) }

// Date writes an ISO date in the language: "31 decembrie 2026" or "31 December 2026".
func Date(iso string, lang reference.Lang) string {
	t, err := time.Parse(time.DateOnly, iso)
	if err != nil {
		return iso
	}
	month := monthsRO[t.Month()-1]
	if lang == reference.EN {
		month = t.Month().String()
	}
	return strconv.Itoa(t.Day()) + " " + month + " " + strconv.Itoa(t.Year())
}

// pillar2Line tells someone how long they have to pick their own Pillar II fund.
func pillar2Line(hire, deadline string, lang reference.Lang) string {
	if lang == reference.EN {
		return "You started on " + Date(hire, lang) + ", so you can choose your own fund until " + Date(deadline, lang) + "."
	}
	return "Te-ai angajat pe " + Date(hire, lang) + ", așa că îți poți alege singur fondul până pe " + Date(deadline, lang) + "."
}
