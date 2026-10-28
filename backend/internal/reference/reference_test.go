package reference

import (
	"reflect"
	"testing"
)

// English moments must differ from Romanian only in words: same ids, triggers, conditions,
// step types, answer keys, numbers and follow-up days.
func TestEnglishMomentsMirrorRomanian(t *testing.T) {
	ro, en := MomentDefs(RO), MomentDefs(EN)
	if len(ro) != len(en) {
		t.Fatalf("%d Romanian moments, %d English", len(ro), len(en))
	}
	textKeys := map[string]bool{"question": true, "title": true, "body": true, "link": true}
	for i := range ro {
		a, b := ro[i], en[i]
		if a.ID != b.ID || !reflect.DeepEqual(a.Triggers, b.Triggers) || !reflect.DeepEqual(a.RepeatOn, b.RepeatOn) ||
			!reflect.DeepEqual(a.Conditions, b.Conditions) || a.FollowUpDays != b.FollowUpDays || a.Minutes != b.Minutes || len(a.Steps) != len(b.Steps) {
			t.Errorf("%s: structure differs", a.ID)
			continue
		}
		for j := range a.Steps {
			for k, v := range a.Steps[j] {
				if !textKeys[k] && !reflect.DeepEqual(v, b.Steps[j][k]) {
					t.Errorf("%s step %d: %q is %v in Romanian, %v in English", a.ID, j, k, v, b.Steps[j][k])
				}
			}
			if len(a.Steps[j]) != len(b.Steps[j]) {
				t.Errorf("%s step %d: different fields", a.ID, j)
			}
		}
		if a.Title == b.Title {
			t.Errorf("%s: title not translated", a.ID)
		}
	}
}

func TestEnglishCoversSeedData(t *testing.T) {
	for _, o := range offers {
		if _, ok := english.Offers[o.ID]; !ok {
			t.Errorf("offer %s has no English text", o.ID)
		}
	}
	for _, s := range scenarios {
		if _, ok := english.Scenarios[s.ID]; !ok {
			t.Errorf("scenario %s has no English text", s.ID)
		}
	}
	ro, en := Offers(RO), Offers(EN)
	for i := range ro {
		if ro[i].GrossRatePct != en[i].GrossRatePct || ro[i].ID != en[i].ID || !reflect.DeepEqual(ro[i].PartnerID, en[i].PartnerID) {
			t.Errorf("offer %s: numbers differ between languages", ro[i].ID)
		}
	}
	if en[0].Provider != "Romanian state" {
		t.Errorf("English provider = %q", en[0].Provider)
	}
	if LatestCPI(EN).Source == LatestCPI(RO).Source {
		t.Error("CPI source not translated")
	}
	if ParseLang("en") != EN || ParseLang("ro") != RO || ParseLang("fr") != RO || ParseLang("") != RO {
		t.Error("ParseLang")
	}
}

// Real providers carry an official link and a dated source, and none of them is a partner:
// only the fictional demo bank is, and its offer never reaches a list.
func TestRealProviders(t *testing.T) {
	for _, o := range Offers(RO) {
		if o.DemoOnly || o.PartnerID != nil || o.Example != nil {
			t.Errorf("offer %s: listed offers must be real and not partners", o.ID)
		}
		if o.URL == "" || o.CheckedAt == "" || o.Source == nil || o.Source.URL == "" || o.AssetID == "" {
			t.Errorf("offer %s: needs url, checkedAt, source and assetId", o.ID)
		}
	}
	if demo, ok := FindOffer("demo-bank-12m", RO); !ok || demo.PartnerID == nil || *demo.PartnerID != "demo-bank" {
		t.Error("the demo partner's offer must still be found for the referral demo")
	}
	for _, o := range Offers(EN) {
		if o.ID == "demo-bank-12m" {
			t.Error("demo offer listed")
		}
	}
	for _, id := range []string{"cont_economii", "depozit", "titluri_stat"} {
		if len(AssetOffers(id, RO)) == 0 {
			t.Errorf("no offers for %s", id)
		}
	}
	ro, en := Brokers(RO), Brokers(EN)
	if len(ro) == 0 || !IsBrokerAsset("etf") || IsBrokerAsset("depozit") {
		t.Fatal("brokers")
	}
	for i, b := range ro {
		if b.URL == "" || b.CheckedAt == "" || b.Source == nil {
			t.Errorf("broker %s: needs url, checkedAt and source", b.ID)
		}
		if _, ok := english.Brokers[b.ID]; !ok || en[i].CostInputs() != b.CostInputs() {
			t.Errorf("broker %s: English text missing or numbers differ", b.ID)
		}
	}
	if en[0].Source.Label == ro[0].Source.Label {
		t.Error("broker source not translated")
	}
}
