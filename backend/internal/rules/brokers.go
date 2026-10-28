package rules

import (
	"sort"
	"strings"
)

// BrokerOrderLei is the order size brokers are compared on.
const BrokerOrderLei = 1000

type Broker struct {
	ID string `json:"id"`
	// Name is the broker's own name.
	Name string `json:"name"`
	// RO = Romanian broker, EU = elsewhere in the EU.
	Country   string `json:"country"`
	Regulator string `json:"regulator"`
	// Commission is max(CommissionPct × order, MinCommissionLei) + FixedFeeLei.
	CommissionPct    float64 `json:"commissionPct"`
	MinCommissionLei float64 `json:"minCommissionLei"`
	FixedFeeLei      float64 `json:"fixedFeeLei"`
	// FXPct is the currency conversion on the order, when it's bought in another currency.
	FXPct float64 `json:"fxPct"`
	// WithholdsTax: a Romanian broker withholds the tax on gains (3% held a year or more, 6% less).
	// Elsewhere the investor declares it in the Declarația unică.
	WithholdsTax bool     `json:"withholdsTax"`
	Conditions   []string `json:"conditions"`
	URL          string   `json:"url"`
	CheckedAt    string   `json:"checkedAt"`
	Source       *Source  `json:"source,omitempty"`
	// Clients is the broker's clients in Romania (data/seed/clients.json), when known.
	Clients *Clients `json:"clients,omitempty"`
}

type RankedBroker struct {
	Broker
	Rank    int     `json:"rank"`
	CostLei float64 `json:"costLei"`
}

// BrokerCostLei is what one order of amountLei costs: commission (with its minimum), fixed fee and conversion.
func BrokerCostLei(b Broker, amountLei float64) float64 {
	commission := max(b.CommissionPct/100*amountLei, b.MinCommissionLei) + b.FixedFeeLei
	return RoundTo(commission+b.FXPct/100*amountLei, 2)
}

// RankBrokers orders brokers by the cost of a 1,000 lei order, then name. Like the savings
// ranking, partner status is not an input (brokers carry none).
func RankBrokers(brokers []Broker) []RankedBroker {
	out := make([]RankedBroker, 0, len(brokers))
	for _, b := range brokers {
		out = append(out, RankedBroker{Broker: b, CostLei: BrokerCostLei(b, BrokerOrderLei)})
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].CostLei != out[j].CostLei {
			return out[i].CostLei < out[j].CostLei
		}
		return strings.Compare(out[i].Name, out[j].Name) < 0
	})
	for i := range out {
		out[i].Rank = i + 1
	}
	return out
}

// CostInputs are the numbers that decide a broker's cost, for checks that translations kept them.
func (b Broker) CostInputs() [4]float64 {
	return [4]float64{b.CommissionPct, b.MinCommissionLei, b.FixedFeeLei, b.FXPct}
}
