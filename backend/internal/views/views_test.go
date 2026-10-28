package views

import (
	"reflect"
	"testing"

	"rost/backend/internal/reference"
)

func maria(t *testing.T) reference.DemoUser {
	t.Helper()
	for _, u := range reference.DemoUsers() {
		if u.ID == "maria" {
			return u
		}
	}
	t.Fatal("no maria in demo-users.json")
	return reference.DemoUser{}
}

func TestMariaView(t *testing.T) {
	v, err := Build(maria(t), nil, reference.RO)
	if err != nil {
		t.Fatal(err)
	}
	if v.Payslip.Pension != 1500 || v.Payslip.Pillar2 != 285 || *v.Payslip.Pillar2Deadline != "2026-12-31" {
		t.Errorf("payslip = %+v", v.Payslip)
	}
	iv := v.Inflation
	if iv.HeadlinePct != 6.61 || iv.Personal.PersonalPct != 8.48 || iv.RealSalary.NowWorth != 5531 || *iv.BufferTarget != 8140 {
		t.Errorf("inflation = %+v", iv)
	}
	if v.Scenario.MonthlySpend != 400 {
		t.Errorf("scenario spend = %v", v.Scenario.MonthlySpend)
	}
	if v.Vars["gross"] != "6.000" || v.Vars["bufferTarget"] != "8.140" {
		t.Errorf("vars = %v", v.Vars)
	}
}

// 10,000 lei of savings against her own inflation (8.48%).
func TestSavingsComparison(t *testing.T) {
	v, _ := Build(maria(t), nil, reference.RO)
	var got [][2]float64
	for _, r := range v.Inflation.Savings.Rows {
		got = append(got, [2]float64{r.NetRatePct, r.RealChangeLei})
	}
	want := [][2]float64{
		{0, -782},   // current account
		{4.5, -367}, // best instant access: TBI's 5% savings account, minus 10% tax on interest
		{6.6, -173}, // best 1-2 years: tax-free Fidelis 2 years, still under her inflation
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("rows = %v, want %v", got, want)
	}
}

func TestFormatRO(t *testing.T) {
	for in, want := range map[float64]string{6000: "6.000", 285: "285", 1234567: "1.234.567", 8.5: "8,5", -2500: "-2.500"} {
		if got := FormatRO(in); got != want {
			t.Errorf("FormatRO(%v) = %q, want %q", in, got, want)
		}
	}
	if got := DateRO("2026-12-31"); got != "31 decembrie 2026" {
		t.Errorf("DateRO = %q", got)
	}
}

func TestPillar2LineInRomanian(t *testing.T) {
	v, _ := Build(maria(t), nil, reference.RO)
	want := "Te-ai angajat pe 1 septembrie 2026, așa că îți poți alege singur fondul până pe 31 decembrie 2026."
	if v.Vars["pillar2Line"] != want {
		t.Errorf("pillar2Line = %q", v.Vars["pillar2Line"])
	}
}

func TestMariaViewInEnglish(t *testing.T) {
	v, err := Build(maria(t), nil, reference.EN)
	if err != nil {
		t.Fatal(err)
	}
	if v.Vars["gross"] != "6,000" || v.Vars["bufferTarget"] != "8,140" {
		t.Errorf("vars = %v", v.Vars)
	}
	want := "You started on 1 September 2026, so you can choose your own fund until 31 December 2026."
	if v.Vars["pillar2Line"] != want {
		t.Errorf("pillar2Line = %q", v.Vars["pillar2Line"])
	}
	if v.Inflation.Savings.Rows[0].Label != "Current account" || v.Scenario.Title != "What if fuel goes up?" {
		t.Errorf("labels = %q, %q", v.Inflation.Savings.Rows[0].Label, v.Scenario.Title)
	}
	ro, _ := Build(maria(t), nil, reference.RO)
	if ro.Payslip.Pension != v.Payslip.Pension || ro.Inflation.Personal.PersonalPct != v.Inflation.Personal.PersonalPct {
		t.Error("numbers changed with the language")
	}
}
