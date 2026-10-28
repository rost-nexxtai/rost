package server

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"rost/backend/internal/clock"
	"rost/backend/internal/config"
	"rost/backend/internal/reference"
	"rost/backend/internal/store/storetest"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func testServer(db fakeDB, cfg config.Config) http.Handler {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return New(Deps{Logger: logger, DB: db, Store: storetest.New(reference.DemoUsers()...), Config: cfg})
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

// client keeps the session cookie between calls, like a browser.
type client struct {
	t      *testing.T
	h      http.Handler
	cookie *http.Cookie
}

func (c *client) do(method, path, body string) (int, map[string]any) {
	c.t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	c.h.ServeHTTP(rec, req)
	for _, ck := range rec.Result().Cookies() {
		if ck.Name == UIDCookie {
			c.cookie = ck
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
	if question != "Out of your 6,000 lei gross, how much goes to your pension each month?" {
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

	_, click := c.do("POST", "/api/referrals/clicks", `{"offerId":"bank-b-12m"}`)
	clickID := click["clickId"].(string)
	if code, _ := c.do("POST", "/api/referrals/postback", `{"clickId":"`+clickID+`","status":"funded"}`); code != 403 {
		t.Errorf("postback without secret = %d", code)
	}
	if _, ref := c.do("GET", "/api/referrals/"+clickID, ""); ref["partner"].(map[string]any)["id"] != "bank-b" {
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
