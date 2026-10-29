package rules

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"rost/backend/internal/domain"
)

// Hand-checked cases, minimum wage 4,325 lei (July 2026). The minimum-wage line matches the worked
// example on salariile.ro/metodologie (net 2,699 lei); add real payslips here before the demo.
func TestPayslip(t *testing.T) {
	cases := []struct {
		name                                                string
		gross                                               float64
		d                                                   Deduction
		pension, pillar2, health, deduction, incomeTax, net float64
	}{
		{"minimum wage, 200 lei untaxed", 4325, Deduction{}, 1031, 196, 413, 865, 182, 2699},
		{"5,000: 14 steps above the minimum, 13%", 5000, Deduction{}, 1250, 238, 500, 562, 269, 2981},
		{"6,000: 34 steps, 3%", 6000, Deduction{}, 1500, 285, 600, 130, 377, 3523},
		{"6,000 under 26: 3% + 15%", 6000, Deduction{Young: true}, 1500, 285, 600, 779, 312, 3588},
		{"9,000: above the cap", 9000, Deduction{Young: true}, 2250, 428, 900, 0, 585, 5265},
		{"12,000", 12000, Deduction{}, 3000, 570, 1200, 0, 780, 7020},
		{"nothing", 0, Deduction{}, 0, 0, 0, 0, 0, 0},
	}
	for _, c := range cases {
		p, err := Payslip(c.gross, c.d)
		if err != nil {
			t.Fatal(err)
		}
		got := []float64{p.Pension, p.Pillar2, p.Health, p.PersonalDeduction, p.IncomeTax, p.Net}
		want := []float64{c.pension, c.pillar2, c.health, c.deduction, c.incomeTax, c.net}
		if !reflect.DeepEqual(got, want) {
			t.Errorf("%s: payslip(%v) = %v, want %v", c.name, c.gross, got, want)
		}
		if p.PublicPension+p.Pillar2 != p.Pension || p.Pension+p.Health+p.IncomeTax+p.Net != c.gross {
			t.Errorf("%s: parts don't add up: %+v", c.name, p)
		}
	}
	if _, err := Payslip(-1, Deduction{}); err == nil {
		t.Error("negative gross should fail")
	}
}

func TestPersonalDeduction(t *testing.T) {
	cases := []struct {
		name  string
		gross float64
		d     Deduction
		want  float64
	}{
		{"at the minimum wage, 20%", 4325, Deduction{}, 865},
		{"4 or more dependants, 45%", 4325, Deduction{Dependants: 6}, 1946},
		{"1 lei above the minimum: 19.5%", 4326, Deduction{}, 843},
		{"50 lei above: still the first step", 4375, Deduction{}, 843},
		{"51 lei above: second step, 19%", 4376, Deduction{}, 822},
		{"at the cap, 40 steps: 0%", 6325, Deduction{}, 0},
		{"at the cap, under 26: 15% stays", 6325, Deduction{Young: true}, 649},
		{"above the cap: nothing", 6326, Deduction{Young: true}, 0},
		{"no salary", 0, Deduction{Young: true}, 0},
	}
	for _, c := range cases {
		if got := PersonalDeduction(c.gross, c.d); got != c.want {
			t.Errorf("%s: PersonalDeduction(%v, %+v) = %v, want %v", c.name, c.gross, c.d, got, c.want)
		}
	}
	if !DeductionFor("sub_25").Young || DeductionFor("25_29").Young || DeductionFor("").Young {
		t.Error("only the under-25 band is surely under 26")
	}
}

// INS, September 2026: headline 6.61%, services 11.12%, non-food 7.06%, food 3.00%.
var sept2026 = domain.CategoryShares{Services: 11.12, NonFood: 7.06, Food: 3.0}

func TestPersonalInflation(t *testing.T) {
	r, err := PersonalInflationFor(domain.CategoryShares{Services: 0.55, NonFood: 0.25, Food: 0.2}, sept2026)
	if err != nil {
		t.Fatal(err)
	}
	if r.PersonalPct != 8.48 || r.Contributions != (domain.CategoryShares{Services: 6.12, NonFood: 1.77, Food: 0.6}) {
		t.Errorf("got %+v", r)
	}
	a, _ := PersonalInflationFor(domain.CategoryShares{Services: 55, NonFood: 25, Food: 20}, sept2026)
	if a.PersonalPct != 8.48 {
		t.Errorf("unnormalised shares: got %v", a.PersonalPct)
	}
	if _, err := PersonalInflationFor(domain.CategoryShares{}, sept2026); err == nil {
		t.Error("empty mix should fail")
	}
}

func TestRealValuesScenariosBuffer(t *testing.T) {
	checks := []struct {
		name      string
		got, want float64
	}{
		{"real salary", RealValue(6000, 8.48), 5531},
		{"cash", RealChange(10000, 0, 6.61), -620},
		{"deposit", RealChange(10000, 4.05, 6.61), -240},
		{"state bond", RealChange(10000, 7.6, 6.61), 93},
		{"fuel +20%", ScenarioExtra(400, 20), 80},
		{"buffer", BufferTarget(2500, 8.48, 3), 8140},
	}
	for _, c := range checks {
		if c.got != c.want {
			t.Errorf("%s = %v, want %v", c.name, c.got, c.want)
		}
	}
}

func loadOffers(t *testing.T) []Offer {
	t.Helper()
	raw, err := os.ReadFile("../reference/data/seed/offers.json")
	if err != nil {
		t.Fatal(err)
	}
	var seed struct{ Offers []Offer }
	if err := json.Unmarshal(raw, &seed); err != nil {
		t.Fatal(err)
	}
	return seed.Offers
}

func ids(r []RankedOffer) []string {
	out := []string{}
	for _, o := range r {
		out = append(out, o.ID)
	}
	return out
}

func TestNetRate(t *testing.T) {
	if NetRatePct(Deposit, 5.25) != 4.73 || NetRatePct(StateBond, 7.6) != 7.6 {
		t.Error("net rate")
	}
}

func TestRanking(t *testing.T) {
	offers := loadOffers(t)
	r := RankOffers(offers, OneToTwoYears, 5000)
	want := []string{"fidelis-2y-lei", "tezaur-1y", "procredit-12m", "tbi-12m", "unicredit-12m"}
	if !reflect.DeepEqual(ids(r)[:5], want) {
		t.Fatalf("order = %v, want %v first", ids(r), want)
	}
	// Tax-free 6.60% beats a 7.00% deposit, which keeps 6.30% after the 10% tax.
	if r[0].GainLei != 330 || r[2].NetRatePct != 6.3 || r[2].GainLei != 315 {
		t.Errorf("fidelis gain = %v, procredit net = %v gain = %v", r[0].GainLei, r[2].NetRatePct, r[2].GainLei)
	}
	if got := ids(RankOffers(offers, AnyTime, 1000)); got[0] != "tbi-economii" || len(got) != 10 {
		t.Errorf("any_time = %v", got)
	}
	for _, id := range ids(RankOffers(offers, OneToTwoYears, 1000)) {
		if id == "fidelis-2y-lei" {
			t.Error("minimum amount not applied")
		}
	}
}

func TestRankingIgnoresPartners(t *testing.T) {
	offers := loadOffers(t)
	base := ids(RankOffers(offers, OneToTwoYears, 5000))
	someone := "someone"
	flipped, all := make([]Offer, len(offers)), make([]Offer, len(offers))
	for i, o := range offers {
		f := o
		if o.PartnerID != nil {
			f.PartnerID = nil
		} else {
			f.PartnerID = &someone
		}
		flipped[i] = f
		a := o
		a.PartnerID = &someone
		all[i] = a
	}
	if !reflect.DeepEqual(ids(RankOffers(flipped, OneToTwoYears, 5000)), base) ||
		!reflect.DeepEqual(ids(RankOffers(all, OneToTwoYears, 5000)), base) {
		t.Error("partner status changed the order")
	}
}

func TestRankByNetKeepsEveryOffer(t *testing.T) {
	var bonds []Offer
	for _, o := range loadOffers(t) {
		if o.AssetID == "titluri_stat" {
			bonds = append(bonds, o)
		}
	}
	got := ids(RankByNet(bonds, 1000))
	want := []string{"fidelis-10y-lei", "tezaur-5y", "fidelis-4y-lei", "tezaur-3y", "fidelis-2y-lei", "tezaur-1y"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("bonds = %v, want %v (no minimum or horizon filter)", got, want)
	}
}

func TestRankBrokers(t *testing.T) {
	raw, err := os.ReadFile("../reference/data/seed/brokers.json")
	if err != nil {
		t.Fatal(err)
	}
	var seed struct{ Brokers []Broker }
	if err := json.Unmarshal(raw, &seed); err != nil {
		t.Fatal(err)
	}
	r := RankBrokers(seed.Brokers)
	got := map[string]float64{}
	order := []string{}
	for _, b := range r {
		got[b.ID] = b.CostLei
		order = append(order, b.ID)
	}
	// Hand-checked for a 1,000 lei order.
	want := map[string]float64{"trading212": 1.5, "xtb": 5, "bt-capital-partners": 5.4, "tradeville": 5.73, "interactive-brokers": 6.36}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("costs = %v, want %v", got, want)
	}
	if !reflect.DeepEqual(order, []string{"trading212", "xtb", "bt-capital-partners", "tradeville", "interactive-brokers"}) || r[0].Rank != 1 {
		t.Errorf("order = %v", order)
	}
	// The minimum applies to small orders: 0.05% of 1,000 lei is 0.50 lei, the minimum is 6.36 lei.
	if BrokerCostLei(Broker{CommissionPct: 0.05, MinCommissionLei: 6.36}, 1000) != 6.36 {
		t.Error("minimum commission")
	}
}

func TestRankingTies(t *testing.T) {
	o := loadOffers(t)[3]
	locked, flexible := o, o
	locked.ID, locked.Provider, locked.AccessRank, locked.GrossRatePct = "locked", "A", 3, 5
	flexible.ID, flexible.Provider, flexible.AccessRank, flexible.GrossRatePct = "flexible", "Z", 2, 5
	if got := ids(RankOffers([]Offer{locked, flexible}, OneToTwoYears, 5000)); !reflect.DeepEqual(got, []string{"flexible", "locked"}) {
		t.Errorf("ties = %v", got)
	}
}

func TestDates(t *testing.T) {
	if got := Pillar2Deadline("2026-09-01"); got != "2026-12-31" {
		t.Errorf("deadline = %s", got)
	}
	if got := AddMonths("2026-10-31", 4); got != "2027-02-28" {
		t.Errorf("clamp = %s", got)
	}
	if got := DaysBetween("2026-12-01", "2026-12-31"); got != 30 {
		t.Errorf("days = %d", got)
	}
}
