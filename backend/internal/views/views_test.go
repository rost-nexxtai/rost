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
	v, err := Build(maria(t), nil)
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
	v, _ := Build(maria(t), nil)
	var got [][2]float64
	for _, r := range v.Inflation.Savings.Rows {
		got = append(got, [2]float64{r.NetRatePct, r.RealChangeLei})
	}
	want := [][2]float64{
		{0, -782},    // current account
		{3.42, -466}, // best instant access: 3.8% gross, minus 10% tax on interest
		{7.6, -81},   // best 1-2 years: tax-free state bond, still just under her inflation
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
	v, _ := Build(maria(t), nil)
	want := "Te-ai angajat pe 1 septembrie 2026, așa că îți poți alege singur fondul până pe 31 decembrie 2026."
	if v.Vars["pillar2Line"] != want {
		t.Errorf("pillar2Line = %q", v.Vars["pillar2Line"])
	}
}
