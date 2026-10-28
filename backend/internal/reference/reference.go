// Package reference serves the versioned reference data under data/: moment definitions,
// inflation figures, savings offers, partners, scenarios and demo personas. It is reviewed like code.
//
// Romanian is the source language. English is an overlay of words only (data/moments/en and
// data/seed/en.json); ids and numbers always come from the Romanian files.
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

// Lang is the language text is served in.
type Lang string

const (
	RO Lang = "ro"
	EN Lang = "en"
)

// ParseLang reads a cookie value; anything but "en" is Romanian.
func ParseLang(v string) Lang {
	if v == string(EN) {
		return EN
	}
	return RO
}

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

// Public is what a client may see of a partner, with the display name in the given language.
func (p Partner) Public(lang Lang) PublicPartner {
	name := p.DisplayName
	if n, ok := english.Partners[p.ID]; ok && lang == EN {
		name = n
	}
	return PublicPartner{p.ID, p.Kind, name, p.Theme, p.FeePerFundedLei, p.FeeIsExample}
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

type offerText struct {
	Provider   string   `json:"provider"`
	Product    string   `json:"product"`
	Conditions []string `json:"conditions"`
}

type scenarioText struct {
	Title   string `json:"title"`
	Context string `json:"context"`
}

var (
	cpi       []CPIRelease
	offers    []rules.Offer
	partners  []Partner
	scenarios []Scenario
	demoUsers []DemoUser
	defs      map[Lang][]moments.Definition

	// english holds the words from data/seed/en.json, keyed by id.
	english struct {
		CPISource string                  `json:"cpiSource"`
		Offers    map[string]offerText    `json:"offers"`
		Partners  map[string]string       `json:"partners"`
		Scenarios map[string]scenarioText `json:"scenarios"`
	}
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

	load("seed/en.json", &english)

	defs = map[Lang][]moments.Definition{}
	for _, name := range []string{"payslip_explained", "personal_inflation", "whatif_shock"} {
		var ro, en moments.Definition
		load("moments/"+name+".json", &ro)
		load("moments/en/"+name+".json", &en)
		defs[RO] = append(defs[RO], ro)
		defs[EN] = append(defs[EN], en)
	}
}

// Offers lists the savings offers, with provider, product and conditions in the given language.
func Offers(lang Lang) []rules.Offer {
	out := make([]rules.Offer, 0, len(offers))
	for _, o := range offers {
		if t, ok := english.Offers[o.ID]; ok && lang == EN {
			o.Provider, o.Product, o.Conditions = t.Provider, t.Product, append([]string{}, t.Conditions...)
		}
		out = append(out, o)
	}
	return out
}

func FindOffer(id string, lang Lang) (rules.Offer, bool) {
	for _, o := range Offers(lang) {
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

// LatestCPI is the newest inflation release, with its source label in the given language.
func LatestCPI(lang Lang) CPIRelease {
	sorted := append([]CPIRelease(nil), cpi...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].Period > sorted[j].Period })
	latest := sorted[0]
	if lang == EN && english.CPISource != "" {
		latest.Source = english.CPISource
	}
	return latest
}

// Scenarios lists approved scenarios only: only those can reach users.
func Scenarios(lang Lang) []Scenario {
	out := []Scenario{}
	for _, s := range scenarios {
		if s.Status != "approved" {
			continue
		}
		if t, ok := english.Scenarios[s.ID]; ok && lang == EN {
			s.Title, s.Context = t.Title, t.Context
		}
		out = append(out, s)
	}
	return out
}

func GetScenario(id any, lang Lang) (Scenario, bool) {
	for _, s := range Scenarios(lang) {
		if s.ID == id {
			return s, true
		}
	}
	return Scenario{}, false
}

// MomentDefs are the moment definitions in the given language. Both languages have the same ids,
// triggers and step shapes (a test checks it), so the engine can decide on either.
func MomentDefs(lang Lang) []moments.Definition {
	return append([]moments.Definition(nil), defs[ParseLang(string(lang))]...)
}

func GetMomentDef(id string, lang Lang) (moments.Definition, bool) {
	for _, d := range MomentDefs(lang) {
		if d.ID == id {
			return d, true
		}
	}
	return moments.Definition{}, false
}

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
