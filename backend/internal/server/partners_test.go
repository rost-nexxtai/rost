package server

import (
	"reflect"
	"testing"
)

func ids(rows []any) []any {
	out := []any{}
	for _, r := range rows {
		out = append(out, r.(map[string]any)["id"])
	}
	return out
}

func partnerIDs(rows []any) []any {
	out := []any{}
	for _, r := range rows {
		if m := r.(map[string]any); m["isPartner"] == true {
			out = append(out, m["id"])
		}
	}
	return out
}

func TestPartnerMarksAreLabelsOnly(t *testing.T) {
	c := adminClient(t)
	if code, _ := c.do("GET", "/api/admin/providers", ""); code != 401 {
		t.Fatalf("providers without login = %d", code)
	}
	c.login()

	_, list := c.do("GET", "/api/admin/providers", "")
	providers := list["providers"].([]any)
	keys := map[any]bool{}
	for _, p := range providers {
		keys[p.(map[string]any)["key"]] = true
	}
	if !keys["bank:Banca Transilvania"] || !keys["broker:xtb"] || keys["bank:Statul român"] || keys["bank:[PARTNER BANK]"] {
		t.Fatalf("markable providers = %v", keys)
	}

	_, depBefore := c.do("GET", "/api/providers/depozit", "")
	_, etfBefore := c.do("GET", "/api/providers/etf", "")

	// A bank that is not first, and the cheapest-but-unknown broker: if marks moved rows, these would.
	for _, key := range []string{"bank:CEC%20Bank", "broker:interactive-brokers"} {
		if code, out := c.do("PUT", "/api/admin/providers/"+key, `{"partner":true}`); code != 200 || out["provider"].(map[string]any)["partner"] != true {
			t.Fatalf("mark %s = %d %v", key, code, out)
		}
	}
	if code, _ := c.do("PUT", "/api/admin/providers/bank:Nimeni", `{"partner":true}`); code != 404 {
		t.Errorf("unknown provider = %d", code)
	}
	if code, _ := c.do("PUT", "/api/admin/providers/bank:BRD", `{}`); code != 400 {
		t.Errorf("missing partner = %d", code)
	}

	_, depAfter := c.do("GET", "/api/providers/depozit", "")
	_, etfAfter := c.do("GET", "/api/providers/etf", "")
	if !reflect.DeepEqual(ids(depBefore["offers"].([]any)), ids(depAfter["offers"].([]any))) {
		t.Errorf("deposit order changed:\n%v\n%v", ids(depBefore["offers"].([]any)), ids(depAfter["offers"].([]any)))
	}
	if !reflect.DeepEqual(ids(etfBefore["brokers"].([]any)), ids(etfAfter["brokers"].([]any))) {
		t.Errorf("broker order changed")
	}
	// CEC has a 12, a 24 and a 36-month deposit.
	if got := partnerIDs(depAfter["offers"].([]any)); len(got) != 3 {
		t.Errorf("CEC deposits marked = %v", got)
	}
	for _, id := range partnerIDs(depAfter["offers"].([]any)) {
		if id.(string)[:4] != "cec-" {
			t.Errorf("non-CEC deposit marked: %v", id)
		}
	}
	if got := partnerIDs(etfAfter["brokers"].([]any)); !reflect.DeepEqual(got, []any{"interactive-brokers"}) {
		t.Errorf("brokers marked = %v", got)
	}

	// The English list carries the same marks.
	c.lang = "en"
	_, all := c.do("GET", "/api/providers", "")
	marked := 0
	for _, a := range all["assets"].([]any) {
		for _, kind := range []string{"offers", "brokers"} {
			if rows, ok := a.(map[string]any)[kind].([]any); ok {
				marked += len(partnerIDs(rows))
			}
		}
	}
	// CEC: 1 savings account + 3 deposits; Interactive Brokers on etf, actiuni and aur.
	if marked != 7 {
		t.Errorf("marked rows in /api/providers = %d, want 7", marked)
	}

	c.do("PUT", "/api/admin/providers/bank:CEC%20Bank", `{"partner":false}`)
	_, dep := c.do("GET", "/api/providers/depozit", "")
	if got := partnerIDs(dep["offers"].([]any)); len(got) != 0 {
		t.Errorf("after unmarking = %v", got)
	}
}
