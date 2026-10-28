// Package reference serves the versioned reference data under data/: moment definitions,
// inflation figures, savings offers, partners, scenarios and demo personas. It is reviewed like code.
package reference

import (
	"embed"
	"encoding/json"
	"fmt"
	"sort"

	"rost/backend/internal/domain"
	"rost/backend/internal/moments"
	"rost/backend/internal/rules"
)

//go:embed data
var files embed.FS

type CPIRelease struct {
	Period      string                `json:"period"`
	HeadlinePct float64               `json:"headlinePct"`
	GroupsPct   domain.CategoryShares `json:"groupsPct"`
	Source      string                `json:"source"`
	URL         string                `json:"url"`
	PublishedAt string                `json:"publishedAt"`
}

type Theme struct {
	Primary string `json:"primary"`
	Ground  string `json:"ground"`
	Ink     string `json:"ink"`
}

type Partner struct {
	ID              string  `json:"id"`
	Kind            string  `json:"kind"`
	DisplayName     string  `json:"displayName"`
	Theme           *Theme  `json:"theme"`
	SecretEnv       *string `json:"secretEnv"`
	FeePerFundedLei float64 `json:"feePerFundedLei"`
	FeeIsExample    *bool   `json:"feeIsExample,omitempty"`
}

// PublicPartner is what a client may see of a partner (no secret names).
type PublicPartner struct {
	ID              string  `json:"id"`
	Kind            string  `json:"kind"`
	DisplayName     string  `json:"displayName"`
	Theme           *Theme  `json:"theme"`
	FeePerFundedLei float64 `json:"feePerFundedLei"`
	FeeIsExample    *bool   `json:"feeIsExample,omitempty"`
}

func (p Partner) Public() PublicPartner {
	return PublicPartner{p.ID, p.Kind, p.DisplayName, p.Theme, p.FeePerFundedLei, p.FeeIsExample}
}

type Scenario struct {
	ID              string  `json:"id"`
	Title           string  `json:"title"`
	Context         string  `json:"context"`
	SpendLine       string  `json:"spendLine"`
	DefaultShockPct float64 `json:"defaultShockPct"`
	MinShockPct     float64 `json:"minShockPct"`
	MaxShockPct     float64 `json:"maxShockPct"`
	Status          string  `json:"status"`
	ReviewedBy      string  `json:"reviewedBy"`
}

// DemoUser is a synthetic persona from data/seed/demo-users.json.
type DemoUser = domain.User

// Correct = index of the right option
type QuizQuestion struct {
	ID       string   `json:"id"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Correct  int      `json:"correct"`
	Explain  string   `json:"explain,omitempty"`
}

var (
	cpi       []CPIRelease
	offers    []rules.Offer
	partners  []Partner
	scenarios []Scenario
	demoUsers []DemoUser
	defs      []moments.Definition
	quiz      []QuizQuestion
)

func load(path string, v any) {
	raw, err := files.ReadFile("data/" + path)
	if err != nil {
		panic(fmt.Sprintf("reference: %v", err))
	}
	if err := json.Unmarshal(raw, v); err != nil {
		panic(fmt.Sprintf("reference: %s: %v", path, err))
	}
}

func init() {
	var macro struct{ CPI []CPIRelease }
	load("seed/macro.json", &macro)
	cpi = macro.CPI

	var o struct{ Offers []rules.Offer }
	load("seed/offers.json", &o)
	offers = o.Offers

	var p struct{ Partners []Partner }
	load("seed/partners.json", &p)
	partners = p.Partners

	var s struct{ Scenarios []Scenario }
	load("seed/scenarios.json", &s)
	scenarios = s.Scenarios

	var u struct{ Users []DemoUser }
	load("seed/demo-users.json", &u)
	demoUsers = u.Users

	var q struct{ Knowledge []QuizQuestion }
	load("seed/quiz.json", &q)
	quiz = q.Knowledge

	for _, name := range []string{"payslip_explained", "personal_inflation", "whatif_shock"} {
		var d moments.Definition
		load("moments/"+name+".json", &d)
		defs = append(defs, d)
	}
}

func Offers() []rules.Offer { return append([]rules.Offer(nil), offers...) }

func FindOffer(id string) (rules.Offer, bool) {
	for _, o := range offers {
		if o.ID == id {
			return o, true
		}
	}
	return rules.Offer{}, false
}

func Partners() []Partner { return append([]Partner(nil), partners...) }

func GetPartner(id *string) (Partner, bool) {
	if id == nil {
		return Partner{}, false
	}
	for _, p := range partners {
		if p.ID == *id {
			return p, true
		}
	}
	return Partner{}, false
}

func LatestCPI() CPIRelease {
	sorted := append([]CPIRelease(nil), cpi...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Period > sorted[j].Period })
	return sorted[0]
}

// Scenarios lists approved scenarios only: only those can reach users.
func Scenarios() []Scenario {
	out := []Scenario{}
	for _, s := range scenarios {
		if s.Status == "approved" {
			out = append(out, s)
		}
	}
	return out
}

func GetScenario(id any) (Scenario, bool) {
	for _, s := range Scenarios() {
		if s.ID == id {
			return s, true
		}
	}
	return Scenario{}, false
}

func MomentDefs() []moments.Definition { return append([]moments.Definition(nil), defs...) }

func GetMomentDef(id string) (moments.Definition, bool) {
	for _, d := range defs {
		if d.ID == id {
			return d, true
		}
	}
	return moments.Definition{}, false
}

func Quiz() []QuizQuestion { return append([]QuizQuestion(nil), quiz...) }

// DemoUsers are the synthetic personas seeded into the database.
func DemoUsers() []DemoUser { return append([]DemoUser(nil), demoUsers...) }

func IsDemoUser(id string) bool {
	for _, u := range demoUsers {
		if u.ID == id {
			return true
		}
	}
	return false
}
