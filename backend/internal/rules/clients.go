package rules

import (
	"sort"
	"strings"
)

// Clients is how many clients a provider has in Romania. Lists show the best-known providers first;
// the count only orders them and is shown with its source, never used in a calculation.
type Clients struct {
	Count int `json:"count"`
	// Estimate: a press estimate, not a number the provider published.
	Estimate bool   `json:"estimate,omitempty"`
	AsOf     string `json:"asOf"`
	Source   Source `json:"source"`
}

func clientCount(c *Clients) int {
	if c == nil {
		return -1
	}
	return c.Count
}

// ByClients orders offers by the provider's clients in Romania, most first; providers without a
// Romanian figure come last. Each provider's best offer comes first (offers arrive from RankByNet,
// best rate first), then everyone's second offer, and so on: the top of the list is several banks,
// not three terms at the same one. Ranks are renumbered.
func ByClients(offers []RankedOffer) []RankedOffer {
	out := append([]RankedOffer(nil), offers...)
	round := make(map[string]int, len(out))
	seen := map[string]int{}
	for _, o := range out {
		round[o.ID] = seen[o.Provider]
		seen[o.Provider]++
	}
	sort.SliceStable(out, func(i, j int) bool {
		if ri, rj := round[out[i].ID], round[out[j].ID]; ri != rj {
			return ri < rj
		}
		a, b := clientCount(out[i].Clients), clientCount(out[j].Clients)
		if a != b {
			return a > b
		}
		return strings.Compare(out[i].Provider, out[j].Provider) < 0
	})
	for i := range out {
		out[i].Rank = i + 1
	}
	return out
}

// BrokersByClients orders brokers by their clients in Romania, most first; brokers without a
// Romanian figure come last, in the order they came in (RankBrokers: cheapest first).
func BrokersByClients(brokers []RankedBroker) []RankedBroker {
	out := append([]RankedBroker(nil), brokers...)
	sort.SliceStable(out, func(i, j int) bool {
		return clientCount(out[i].Clients) > clientCount(out[j].Clients)
	})
	for i := range out {
		out[i].Rank = i + 1
	}
	return out
}
