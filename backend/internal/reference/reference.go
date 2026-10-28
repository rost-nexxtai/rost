// Package reference serves the versioned reference data under data/: moment definitions,
// inflation figures, savings offers, brokers, partners, scenarios and demo personas. It is reviewed like code.
//
// Romanian is the source language. English is an overlay of words only (data/moments/en and
// data/seed/en.json); ids and numbers always come from the Romanian files.
package reference

import (
	"embed"
	"encoding/json"
	"fmt"
	"slices"
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

type brokerText struct {
	Regulator  string   `json:"regulator"`
	Conditions []string `json:"conditions"`
}

type scenarioText struct {
	Title   string `json:"title"`
	Context string `json:"context"`
}

// Correct = index of the right option
type QuizQuestion struct {
	ID       string   `json:"id"`
	Question string   `json:"question"`
	Options  []string `json:"options"`
	Correct  int      `json:"correct"`
	Explain  string   `json:"explain,omitempty"`
	// The knowledge tier it tests: 0 = the basics (passing skips the L0 lessons), 1 = L1 concepts.
	Tier int `json:"tier"`
}

var (
	cpi     []CPIRelease
	offers  []rules.Offer
	brokers []rules.Broker
	// brokerAssets are the Acasă assets bought through a broker (ETFs, shares, gold).
	brokerAssets []string
	partners     []Partner
	scenarios    []Scenario
	demoUsers    []DemoUser
	defs         map[Lang][]moments.Definition
	quiz         []QuizQuestion

	// english holds the words from data/seed/en.json, keyed by id.
	english struct {
		CPISource string                  `json:"cpiSource"`
		Offers    map[string]offerText    `json:"offers"`
		Brokers   map[string]brokerText   `json:"brokers"`
		Sources   map[string]string       `json:"sources"`
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

	var b struct {
		Assets  []string
		Brokers []rules.Broker
	}
	load("seed/brokers.json", &b)
	brokers, brokerAssets = b.Brokers, b.Assets

	var c struct{ Banks, Brokers map[string]rules.Clients }
	load("seed/clients.json", &c)
	for i := range offers {
		if n, ok := c.Banks[offers[i].Provider]; ok {
			offers[i].Clients = &n
		}
	}
	for i := range brokers {
		if n, ok := c.Brokers[brokers[i].ID]; ok {
			brokers[i].Clients = &n
		}
	}

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

// sourceIn is a source with its label in the given language.
func sourceIn(src *rules.Source, lang Lang) *rules.Source {
	if src == nil {
		return nil
	}
	out := *src
	if t, ok := english.Sources[src.Label]; ok && lang == EN {
		out.Label = t
	}
	return &out
}

func offerIn(o rules.Offer, lang Lang) rules.Offer {
	if t, ok := english.Offers[o.ID]; ok && lang == EN {
		o.Provider, o.Product, o.Conditions = t.Provider, t.Product, append([]string{}, t.Conditions...)
	}
	o.Source = sourceIn(o.Source, lang)
	o.Clients = clientsIn(o.Clients, lang)
	return o
}

func clientsIn(c *rules.Clients, lang Lang) *rules.Clients {
	if c == nil {
		return nil
	}
	out := *c
	out.Source = *sourceIn(&c.Source, lang)
	return &out
}

// Offers lists the real savings offers, with provider, product and conditions in the given
// language. The demo partner's offer is never listed.
func Offers(lang Lang) []rules.Offer {
	out := make([]rules.Offer, 0, len(offers))
	for _, o := range offers {
		if !o.DemoOnly {
			out = append(out, offerIn(o, lang))
		}
	}
	return out
}

// AssetOffers lists the real offers under one Acasă asset (cont_economii, depozit, titluri_stat).
func AssetOffers(assetID string, lang Lang) []rules.Offer {
	out := []rules.Offer{}
	for _, o := range Offers(lang) {
		if o.AssetID == assetID {
			out = append(out, o)
		}
	}
	return out
}

// FindOffer finds any offer by id, the demo partner's included, for referral clicks.
func FindOffer(id string, lang Lang) (rules.Offer, bool) {
	for _, o := range offers {
		if o.ID == id {
			return offerIn(o, lang), true
		}
	}
	return rules.Offer{}, false
}

// Brokers lists the brokers, with regulator, conditions and source in the given language.
func Brokers(lang Lang) []rules.Broker {
	out := make([]rules.Broker, 0, len(brokers))
	for _, b := range brokers {
		if t, ok := english.Brokers[b.ID]; ok && lang == EN {
			b.Regulator, b.Conditions = t.Regulator, append([]string{}, t.Conditions...)
		}
		b.Source = sourceIn(b.Source, lang)
		b.Clients = clientsIn(b.Clients, lang)
		out = append(out, b)
	}
	return out
}

// IsBrokerAsset tells whether an Acasă asset is bought through a broker.
func IsBrokerAsset(assetID string) bool { return slices.Contains(brokerAssets, assetID) }

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
