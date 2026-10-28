package rules

import (
	"sort"
	"strings"
)

type OfferKind string

const (
	Deposit   OfferKind = "deposit"
	StateBond OfferKind = "state_bond"
)

type Horizon string

const (
	AnyTime       Horizon = "any_time"
	OneToTwoYears Horizon = "one_to_two_years"
	Later         Horizon = "later"
)

var Horizons = []Horizon{AnyTime, OneToTwoYears, Later}

type Offer struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	Product      string    `json:"product"`
	Kind         OfferKind `json:"kind"`
	GrossRatePct float64   `json:"grossRatePct"`
	// 0 = instant access.
	TermMonths int `json:"termMonths"`
	// 1 = take it out any time, 2 = lose interest if you break it, 3 = locked until maturity (or sold at market price).
	AccessRank   int      `json:"accessRank"`
	MinAmountLei float64  `json:"minAmountLei"`
	Conditions   []string `json:"conditions"`
	PartnerID    *string  `json:"partnerId"`
	Example      *bool    `json:"example,omitempty"`
	UpdatedAt    string   `json:"updatedAt"`
}

type RankedOffer struct {
	Offer
	Rank       int     `json:"rank"`
	NetRatePct float64 `json:"netRatePct"`
	GainLei    float64 `json:"gainLei"`
	IsPartner  bool    `json:"isPartner"`
}

// NetRatePct is the net yearly rate after tax: deposits lose 10% of interest to tax, state bonds are tax-free.
func NetRatePct(kind OfferKind, grossRatePct float64) float64 {
	net := grossRatePct
	if kind == Deposit {
		net = grossRatePct * (1 - Rules2026.DepositInterestTaxRate)
	}
	return RoundTo(net, 2)
}

func MatchesHorizon(o Offer, h Horizon) bool {
	switch h {
	case AnyTime:
		return o.TermMonths == 0
	case OneToTwoYears:
		return o.TermMonths > 0 && o.TermMonths <= 24
	default:
		return o.TermMonths > 24
	}
}

// RankOffers is the neutral ranking. Public formula: net yearly return after tax, then easier
// access, then name. Partner status is deliberately NOT an input; a test proves it.
func RankOffers(offers []Offer, horizon Horizon, amountLei float64) []RankedOffer {
	type scored struct {
		o   Offer
		net float64
	}
	var list []scored
	for _, o := range offers {
		if MatchesHorizon(o, horizon) && o.MinAmountLei <= amountLei {
			list = append(list, scored{o, NetRatePct(o.Kind, o.GrossRatePct)})
		}
	}
	sort.SliceStable(list, func(i, j int) bool {
		a, b := list[i], list[j]
		if a.net != b.net {
			return a.net > b.net
		}
		if a.o.AccessRank != b.o.AccessRank {
			return a.o.AccessRank < b.o.AccessRank
		}
		return strings.Compare(a.o.Provider+" "+a.o.Product, b.o.Provider+" "+b.o.Product) < 0
	})
	out := make([]RankedOffer, 0, len(list))
	for i, s := range list {
		out = append(out, RankedOffer{
			Offer:      s.o,
			Rank:       i + 1,
			NetRatePct: s.net,
			GainLei:    Round(amountLei * s.net / 100),
			IsPartner:  s.o.PartnerID != nil,
		})
	}
	return out
}
