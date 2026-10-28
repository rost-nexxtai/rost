package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"rost/backend/internal/clock"
	"rost/backend/internal/config"
	"rost/backend/internal/content"
	"rost/backend/internal/reference"
	"rost/backend/internal/store/storetest"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func testServer(db fakeDB, cfg config.Config) http.Handler {
	h, _ := testServerWithStore(db, cfg)
	return h
}

// also seeds content
func testServerWithStore(db fakeDB, cfg config.Config) (http.Handler, *storetest.Memory) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	st := storetest.New(reference.DemoUsers()...)
	seed, err := content.Seed()
	if err != nil {
		panic(err)
	}
	if err := st.SeedContent(context.Background(), content.SeedName, seed); err != nil {
		panic(err)
	}
	return New(Deps{Logger: logger, DB: db, Store: st, Config: cfg}), st
}

func TestHealthAndReadiness(t *testing.T) {
	cases := []struct {
		name string
		path string
		db   fakeDB
		want int
	}{
		{"liveness ignores the database", "/healthz", fakeDB{err: errors.New("down")}, http.StatusOK},
		{"ready when postgres answers", "/readyz", fakeDB{}, http.StatusOK},
		{"not ready when postgres is down", "/readyz", fakeDB{err: errors.New("down")}, http.StatusServiceUnavailable},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			testServer(c.db, config.Config{}).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
			if rec.Code != c.want {
				t.Fatalf("GET %s = %d, want %d", c.path, rec.Code, c.want)
			}
		})
	}
}

// client keeps cookies between calls, like a browser.
type client struct {
	t       *testing.T
	h       http.Handler
	cookies map[string]*http.Cookie
	lang    string
}

func (c *client) do(method, path, body string) (int, map[string]any) {
	c.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for _, ck := range c.cookies {
		req.AddCookie(ck)
	}
	if c.lang != "" {
		req.AddCookie(&http.Cookie{Name: LangCookie, Value: c.lang})
	}
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	if c.cookies == nil {
		c.cookies = map[string]*http.Cookie{}
	}
	for _, ck := range rec.Result().Cookies() {
		if ck.MaxAge < 0 {
			delete(c.cookies, ck.Name)
		} else {
			c.cookies[ck.Name] = ck
		}
	}
	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		c.t.Fatalf("%s %s: not JSON: %s", method, path, rec.Body)
	}
	return rec.Code, out
}

func TestDemoPathOverHTTP(t *testing.T) {
	t.Cleanup(func() { clock.SetOffsetDays(0) })
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{AllowDemoTools: true})}

	if code, _ := c.do("GET", "/api/me", ""); code != 401 {
		t.Fatalf("me without session = %d", code)
	}
	if code, _ := c.do("POST", "/api/users", `{"demo":"someone"}`); code != 404 {
		t.Errorf("non-demo id = %d", code)
	}
	if code, out := c.do("POST", "/api/users", `{"demo":"maria"}`); code != 200 || out["userId"] != "maria" {
		t.Fatalf("demo login = %d %v", code, out)
	}
	if _, out := c.do("GET", "/api/me", ""); out["user"].(map[string]any)["name"] != "Maria" {
		t.Errorf("me = %v", out)
	}

	_, ev := c.do("POST", "/api/events", `{"type":"salary_received"}`)
	runs := ev["runs"].([]any)
	if len(runs) != 1 {
		t.Fatalf("runs = %v", ev)
	}
	runID := runs[0].(map[string]any)["id"].(string)

	_, today := c.do("GET", "/api/today", "")
	if len(today["open"].([]any)) != 1 || today["dueFollowUps"] == nil {
		t.Errorf("today = %v", today)
	}

	code, moment := c.do("GET", "/api/moments/"+runID, "")
	if code != 200 {
		t.Fatalf("moment = %d %v", code, moment)
	}
	question := moment["def"].(map[string]any)["steps"].([]any)[0].(map[string]any)["question"]
	if question != "Din salariul brut de 6.000 lei, cât merge lunar la pensia ta?" {
		t.Errorf("question not filled: %v", question)
	}
	action := moment["def"].(map[string]any)["steps"].([]any)[3].(map[string]any)
	if v, ok := action["defaultOption"]; !ok || v != 400.0 {
		t.Errorf("action step = %v", action)
	}

	if _, out := c.do("POST", "/api/moments/"+runID, `{"kind":"guess","value":300,"answerKey":"pension"}`); out["answer"] != 1500.0 {
		t.Errorf("guess = %v", out)
	}
	if code, _ := c.do("POST", "/api/moments/"+runID, `{"kind":"action","actionType":"payday_savings_rule","params":{"amountLei":400}}`); code != 200 {
		t.Errorf("action = %d", code)
	}

	c.do("POST", "/api/clock", `{"days":7}`)
	_, fu := c.do("GET", "/api/followups", "")
	due := fu["due"].([]any)
	if len(due) != 1 {
		t.Fatalf("due = %v", fu)
	}
	actionID := due[0].(map[string]any)["id"].(string)
	if code, _ := c.do("POST", "/api/followups", `{"actionId":"`+actionID+`","status":"confirmed"}`); code != 200 {
		t.Errorf("confirm = %d", code)
	}

	_, m := c.do("GET", "/api/metrics", "")
	if m["actionRate"] != 1.0 || m["mode"] != "db" {
		t.Errorf("metrics = %v", m)
	}

	if code, _ := c.do("POST", "/api/demo/reset", ""); code != 200 {
		t.Errorf("reset = %d", code)
	}
	if _, today := c.do("GET", "/api/today", ""); len(today["open"].([]any)) != 0 || len(today["doneMomentIds"].([]any)) != 0 {
		t.Errorf("after reset = %v", today)
	}
}

func TestReferralAndEmbedOverHTTP(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{AllowDemoTools: true, PostbackSecret: "s3cret"})}

	_, click := c.do("POST", "/api/referrals/clicks", `{"offerId":"demo-bank-12m"}`)
	clickID := click["clickId"].(string)
	if code, _ := c.do("POST", "/api/referrals/postback", `{"clickId":"`+clickID+`","status":"funded"}`); code != 403 {
		t.Errorf("postback without secret = %d", code)
	}
	if _, ref := c.do("GET", "/api/referrals/"+clickID, ""); ref["partner"].(map[string]any)["id"] != "demo-bank" {
		t.Errorf("referral = %v", ref)
	}

	_, tok := c.do("GET", "/api/partner/demo-token", "")
	if !strings.HasPrefix(tok["url"].(string), "/embed?token=") {
		t.Fatalf("demo token = %v", tok)
	}
	code, embed := c.do("GET", "/api/embed?token="+tok["token"].(string), "")
	if code != 200 || embed["inflation"].(map[string]any)["personal"].(map[string]any)["personalPct"] != 8.48 {
		t.Errorf("embed = %d %v", code, embed)
	}
	if code, _ := c.do("GET", "/api/embed?token=nope", ""); code != 401 {
		t.Errorf("bad token = %d", code)
	}

	if _, opts := c.do("GET", "/api/options?horizon=one_to_two_years&amount=5000", ""); opts["offers"].([]any)[0].(map[string]any)["id"] != "fidelis-2y-lei" {
		t.Errorf("options = %v", opts)
	}
}

func TestProvidersOverHTTP(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}

	code, dep := c.do("GET", "/api/providers/depozit", "")
	offers, _ := dep["offers"].([]any)
	if code != 200 || dep["providerKind"] != "savings" || len(offers) == 0 {
		t.Fatalf("depozit = %d %v", code, dep)
	}
	// best-known bank first (most clients in Romania), with its best rate; the next row is another bank
	if second := offers[1].(map[string]any); second["provider"] != "BCR" {
		t.Errorf("second deposit = %v", second)
	}
	first := offers[0].(map[string]any)
	if first["id"] != "bt-36m" || first["url"] != "https://www.bancatransilvania.ro" || first["isPartner"] != false || first["clients"] == nil {
		t.Errorf("first deposit = %v", first)
	}
	for _, o := range offers {
		if o.(map[string]any)["id"] == "demo-bank-12m" {
			t.Error("the demo partner is listed among real banks")
		}
	}

	code, etf := c.do("GET", "/api/providers/etf", "")
	brokers, _ := etf["brokers"].([]any)
	if code != 200 || etf["providerKind"] != "brokers" || len(brokers) != 5 {
		t.Fatalf("etf = %d %v", code, etf)
	}
	var ids []any
	for _, b := range brokers {
		ids = append(ids, b.(map[string]any)["id"])
	}
	// the two with a Romanian client count, then the rest cheapest first
	if want := []any{"tradeville", "bt-capital-partners", "trading212", "xtb", "interactive-brokers"}; !reflect.DeepEqual(ids, want) {
		t.Errorf("brokers = %v, want %v", ids, want)
	}
	if code, _ := c.do("GET", "/api/providers/nope", ""); code != 404 {
		t.Errorf("unknown asset = %d", code)
	}

	c.lang = "en"
	_, all := c.do("GET", "/api/providers", "")
	assets, _ := all["assets"].([]any)
	if len(assets) != 6 {
		t.Fatalf("all providers = %v", all)
	}
	bonds := assets[2].(map[string]any)["offers"].([]any)[0].(map[string]any)
	if bonds["provider"] != "Romanian state" {
		t.Errorf("English bond provider = %v", bonds["provider"])
	}
}

func TestDemoToolsOff(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{})}
	for _, path := range []string{"/api/clock", "/api/demo/reset"} {
		if code, _ := c.do("POST", path, `{"days":7}`); code != 403 {
			t.Errorf("POST %s = %d", path, code)
		}
	}
	if code, _ := c.do("GET", "/api/partner/demo-token", ""); code != 403 {
		t.Errorf("demo token = %d", code)
	}
	if code, out := c.do("POST", "/api/payslip/read", ""); code != 501 || out["error"] != "not_configured" {
		t.Errorf("payslip = %d %v", code, out)
	}
}

func TestEnglishOverHTTP(t *testing.T) {
	c := &client{t: t, h: testServer(fakeDB{}, config.Config{AllowDemoTools: true}), lang: "en"}
	c.do("POST", "/api/users", `{"demo":"maria"}`)
	_, ev := c.do("POST", "/api/events", `{"type":"salary_received","ignoreWeeklyCap":true}`)
	runID := ev["runs"].([]any)[0].(map[string]any)["id"].(string)

	_, moment := c.do("GET", "/api/moments/"+runID, "")
	def := moment["def"].(map[string]any)
	if def["title"] != "Your payslip, explained" {
		t.Errorf("title = %v", def["title"])
	}
	if q := def["steps"].([]any)[0].(map[string]any)["question"]; q != "Of your 6,000 lei gross salary, how much goes to your pension each month?" {
		t.Errorf("question = %v", q)
	}
	if p := moment["view"].(map[string]any)["payslip"].(map[string]any)["pension"]; p != 1500.0 {
		t.Errorf("pension = %v", p)
	}

	_, today := c.do("GET", "/api/today", "")
	if title := today["moments"].([]any)[1].(map[string]any)["title"]; title != "Your inflation this month" {
		t.Errorf("today title = %v", title)
	}
	_, opts := c.do("GET", "/api/options?horizon=one_to_two_years&amount=5000", "")
	if p := opts["offers"].([]any)[0].(map[string]any)["product"]; p != "Fidelis, 2 years (lei)" {
		t.Errorf("offer product = %v", p)
	}

	c.lang = "ro"
	_, moment = c.do("GET", "/api/moments/"+runID, "")
	if title := moment["def"].(map[string]any)["title"]; title != "Salariul tău, pe înțeles" {
		t.Errorf("Romanian title = %v", title)
	}
}
