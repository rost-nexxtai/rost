package server

import (
	"net/http"

	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
)

// assetProvidersAmount is the balance the savings gains are shown for.
const assetProvidersAmount = 10_000

// Every Acasă asset with providers, in Acasă order.
var providerAssets = []string{"cont_economii", "depozit", "titluri_stat", "etf", "actiuni", "aur"}

type assetProviders struct {
	AssetID string `json:"assetId"`
	// savings: ranked by net rate after tax; brokers: ranked by the cost of a 1,000 lei order.
	ProviderKind string               `json:"providerKind"`
	AmountLei    float64              `json:"amountLei"`
	Offers       []rules.RankedOffer  `json:"offers,omitempty"`
	Brokers      []rules.RankedBroker `json:"brokers,omitempty"`
}

func providersFor(assetID string, lang reference.Lang) (assetProviders, bool) {
	if reference.IsBrokerAsset(assetID) {
		return assetProviders{AssetID: assetID, ProviderKind: "brokers", AmountLei: rules.BrokerOrderLei, Brokers: rules.RankBrokers(reference.Brokers(lang))}, true
	}
	offers := reference.AssetOffers(assetID, lang)
	if len(offers) == 0 {
		return assetProviders{}, false
	}
	return assetProviders{AssetID: assetID, ProviderKind: "savings", AmountLei: assetProvidersAmount, Offers: rules.RankByNet(offers, assetProvidersAmount)}, true
}

// GET /api/providers/{assetId}: the real providers of one asset, in the neutral order. No session needed.
func (s *server) assetProviders(w http.ResponseWriter, r *http.Request) {
	out, ok := providersFor(r.PathValue("assetId"), langOf(r))
	if !ok {
		fail(w, http.StatusNotFound, "unknown asset")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// GET /api/providers: every asset's providers at once, for the Acasă headlines.
func (s *server) allProviders(w http.ResponseWriter, r *http.Request) {
	out := []assetProviders{}
	for _, id := range providerAssets {
		if p, ok := providersFor(id, langOf(r)); ok {
			out = append(out, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"assets": out})
}
