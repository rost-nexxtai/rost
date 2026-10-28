package server

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/rules"
)

// assetProvidersAmount is the balance the savings gains are shown for.
const assetProvidersAmount = 10_000

// Every Acasă asset with providers, in Acasă order.
var providerAssets = []string{"cont_economii", "depozit", "titluri_stat", "etf", "actiuni", "aur"}

type assetProviders struct {
	AssetID string `json:"assetId"`
	// Both listed best-known first (clients in Romania). Savings show the net rate after tax,
	// brokers the cost of a 1,000 lei order.
	ProviderKind string               `json:"providerKind"`
	AmountLei    float64              `json:"amountLei"`
	Offers       []rules.RankedOffer  `json:"offers,omitempty"`
	Brokers      []rules.RankedBroker `json:"brokers,omitempty"`
}

// Partner keys: banks by their Romanian name (the key clients.json uses too), brokers by id.
func bankKey(name string) string { return "bank:" + name }
func brokerKey(id string) string { return "broker:" + id }

// providersFor ranks first and labels partners after, so a partner mark can never move a row.
func providersFor(assetID string, lang reference.Lang, partners map[string]bool) (assetProviders, bool) {
	if reference.IsBrokerAsset(assetID) {
		brokers := rules.BrokersByClients(rules.RankBrokers(reference.Brokers(lang)))
		for i := range brokers {
			brokers[i].IsPartner = partners[brokerKey(brokers[i].ID)]
		}
		return assetProviders{AssetID: assetID, ProviderKind: "brokers", AmountLei: rules.BrokerOrderLei, Brokers: brokers}, true
	}
	offers := reference.AssetOffers(assetID, lang)
	if len(offers) == 0 {
		return assetProviders{}, false
	}
	ranked := rules.ByClients(rules.RankByNet(offers, assetProvidersAmount))
	bank := bankNames()
	for i := range ranked {
		if name, ok := bank[ranked[i].ID]; ok && partners[bankKey(name)] {
			ranked[i].IsPartner = true
		}
	}
	return assetProviders{AssetID: assetID, ProviderKind: "savings", AmountLei: assetProvidersAmount, Offers: ranked}, true
}

// bankNames maps each bank offer to its bank's Romanian name. State bonds have no bank.
func bankNames() map[string]string {
	out := map[string]string{}
	for _, o := range reference.Offers(reference.RO) {
		if o.Kind != rules.StateBond {
			out[o.ID] = o.Provider
		}
	}
	return out
}

func (s *server) partnerSet(ctx context.Context) (map[string]bool, error) {
	keys, err := s.Store.ListPartners(ctx)
	if err != nil {
		return nil, err
	}
	out := make(map[string]bool, len(keys))
	for _, k := range keys {
		out[k] = true
	}
	return out, nil
}

// GET /api/providers/{assetId}: the real providers of one asset, best-known first. No session needed.
func (s *server) assetProviders(w http.ResponseWriter, r *http.Request) {
	partners, err := s.partnerSet(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out, ok := providersFor(r.PathValue("assetId"), langOf(r), partners)
	if !ok {
		fail(w, http.StatusNotFound, "unknown asset")
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// GET /api/providers: every asset's providers at once, for the Acasă headlines.
func (s *server) allProviders(w http.ResponseWriter, r *http.Request) {
	partners, err := s.partnerSet(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out := []assetProviders{}
	for _, id := range providerAssets {
		if p, ok := providersFor(id, langOf(r), partners); ok {
			out = append(out, p)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"assets": out})
}

// ---- admin: partner marks ----

type adminProvider struct {
	Key     string `json:"key"`
	Kind    string `json:"kind"` // "bank" or "broker"
	Name    string `json:"name"`
	Partner bool   `json:"partner"`
}

// Every bank and broker an admin can mark: banks by name, then brokers as listed.
func markableProviders(partners map[string]bool) []adminProvider {
	var banks []string
	for _, name := range bankNames() {
		if !slices.Contains(banks, name) {
			banks = append(banks, name)
		}
	}
	slices.SortFunc(banks, func(a, b string) int { return strings.Compare(strings.ToLower(a), strings.ToLower(b)) })
	out := []adminProvider{}
	for _, name := range banks {
		out = append(out, adminProvider{bankKey(name), "bank", name, partners[bankKey(name)]})
	}
	for _, b := range reference.Brokers(reference.RO) {
		out = append(out, adminProvider{brokerKey(b.ID), "broker", b.Name, partners[brokerKey(b.ID)]})
	}
	return out
}

// GET /api/admin/providers
func (s *server) listPartnerProviders(w http.ResponseWriter, r *http.Request, _ domain.Admin) {
	partners, err := s.partnerSet(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"providers": markableProviders(partners)})
}

// PUT /api/admin/providers/{key} {"partner": bool}
func (s *server) setPartnerProvider(w http.ResponseWriter, r *http.Request, a domain.Admin) {
	var body struct {
		Partner *bool `json:"partner"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	if body.Partner == nil {
		fail(w, http.StatusBadRequest, "partner is required")
		return
	}
	key := r.PathValue("key")
	i := slices.IndexFunc(markableProviders(nil), func(p adminProvider) bool { return p.Key == key })
	if i < 0 {
		fail(w, http.StatusNotFound, "unknown provider")
		return
	}
	if err := s.Store.SetPartner(r.Context(), key, *body.Partner, a.Email); err != nil {
		s.internal(w, r, err)
		return
	}
	s.Logger.Info("partner mark", "provider", key, "partner", *body.Partner, "by", a.Email)
	p := markableProviders(nil)[i]
	p.Partner = *body.Partner
	writeJSON(w, http.StatusOK, map[string]any{"provider": p})
}
