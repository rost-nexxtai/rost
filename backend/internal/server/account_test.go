package server

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"testing"

	"rost/backend/internal/auth"
	"rost/backend/internal/config"
	"rost/backend/internal/domain"
	"rost/backend/internal/mail"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
	"rost/backend/internal/store/storetest"
)

// outbox keeps the mails instead of sending them.
type outbox struct {
	mu   sync.Mutex
	sent []mail.Message
}

func (o *outbox) Send(_ context.Context, m mail.Message) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.sent = append(o.sent, m)
	return nil
}

// last mail's link, as a path on this server
func (o *outbox) link(t *testing.T) string {
	t.Helper()
	o.mu.Lock()
	defer o.mu.Unlock()
	if len(o.sent) == 0 {
		t.Fatal("no mail sent")
	}
	body := o.sent[len(o.sent)-1].Body
	i := strings.Index(body, "https://rost.test/api/auth/verify?token=")
	if i < 0 {
		t.Fatalf("no link in %q", body)
	}
	return strings.TrimPrefix(strings.Fields(body[i:])[0], "https://rost.test")
}

func accountServer(cfg config.Config) (http.Handler, *storetest.Memory, *outbox) {
	cfg.AppURL = "https://rost.test"
	st := storetest.New(reference.DemoUsers()...)
	box := &outbox{}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	return New(Deps{Logger: logger, DB: fakeDB{}, Store: st, Config: cfg, Mailer: box}), st, box
}

const onboarding = `{"situations":["student"]}`

func TestSessionCookie(t *testing.T) {
	h, st, _ := accountServer(config.Config{CookieSecure: true})
	c := &client{t: t, h: h}
	_, out := c.do("POST", "/api/users", onboarding)
	id := out["userId"].(string)

	ck := c.cookies[SessionCookie]
	if ck == nil || !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteLaxMode || ck.Path != "/" || ck.MaxAge != 90*24*60*60 {
		t.Fatalf("cookie = %+v", ck)
	}
	if ck.Value == id || len(ck.Value) != 43 {
		t.Errorf("the token must be 32 random bytes, not the id: %q", ck.Value)
	}
	sessions, _ := st.ListSessions(context.Background(), id)
	if len(sessions) != 1 || sessions[0].TokenHash != auth.HashToken(ck.Value) {
		t.Errorf("sessions = %+v", sessions)
	}
	if code, _ := c.do("GET", "/api/me", ""); code != 200 {
		t.Errorf("me = %d", code)
	}

	// knowing an id is not enough anymore
	for _, name := range []string{SessionCookie, UIDCookie} {
		forged := &client{t: t, h: h, cookies: map[string]*http.Cookie{name: {Name: name, Value: id}}}
		if code, _ := forged.do("GET", "/api/me", ""); code != 401 {
			t.Errorf("%s=<id> = %d", name, code)
		}
	}
	// the quiz starts a session too
	q := &client{t: t, h: h}
	if q.do("POST", "/api/quiz", quizAllNuStiu); q.cookies[SessionCookie] == nil || q.cookies[UIDCookie] != nil {
		t.Errorf("quiz cookies = %v", q.cookies)
	}
}

func TestLegacyUIDCookie(t *testing.T) {
	h, st, _ := accountServer(config.Config{LegacyUIDCookie: true, AllowDemoTools: true})
	c := &client{t: t, h: h, cookies: map[string]*http.Cookie{UIDCookie: {Name: UIDCookie, Value: "maria"}}}
	if _, out := c.do("GET", "/api/me", ""); get(out, "user", "id") != "maria" {
		t.Fatalf("me = %v", out)
	}
	if c.cookies[UIDCookie] != nil || c.cookies[SessionCookie] == nil {
		t.Fatalf("the old cookie is swapped for a session: %v", c.cookies)
	}
	if _, out := c.do("GET", "/api/me", ""); get(out, "user", "id") != "maria" {
		t.Errorf("me with the session = %v", out)
	}
	if ss, _ := st.ListSessions(context.Background(), "maria"); len(ss) != 1 {
		t.Errorf("one session, not one per request: %v", ss)
	}

	unknown := &client{t: t, h: h, cookies: map[string]*http.Cookie{UIDCookie: {Name: UIDCookie, Value: "nobody"}}}
	if code, _ := unknown.do("GET", "/api/me", ""); code != 401 || unknown.cookies[SessionCookie] != nil {
		t.Errorf("unknown id = %d %v", code, unknown.cookies)
	}

	// a demo persona only with demo tools; and with the swap off, the old cookie is only cleared
	for name, cfg := range map[string]config.Config{
		"maria without demo tools": {LegacyUIDCookie: true},
		"swap off":                 {AllowDemoTools: true},
	} {
		h, _, _ := accountServer(cfg)
		c := &client{t: t, h: h, cookies: map[string]*http.Cookie{UIDCookie: {Name: UIDCookie, Value: "maria"}}}
		if code, _ := c.do("GET", "/api/me", ""); code != 401 || c.cookies[SessionCookie] != nil || c.cookies[UIDCookie] != nil {
			t.Errorf("%s = %d %v", name, code, c.cookies)
		}
	}
}

func TestDemoPersonaNeedsDemoTools(t *testing.T) {
	h, _, _ := accountServer(config.Config{})
	c := &client{t: t, h: h}
	if code, _ := c.do("POST", "/api/users", `{"demo":"maria"}`); code != 403 || c.cookies[SessionCookie] != nil {
		t.Errorf("maria without demo tools = %d %v", code, c.cookies)
	}
}

func TestResetErasesTheUser(t *testing.T) {
	h, st, _ := accountServer(config.Config{})
	ctx := context.Background()
	c := &client{t: t, h: h}
	_, out := c.do("POST", "/api/users", `{"situations":["first_job"],"grossMonthly":6000,"payday":10}`)
	id := out["userId"].(string)
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	if _, err := st.CreateRun(ctx, domain.MomentRun{UserID: id, MomentID: "payslip_explained", State: domain.RunPending}); err != nil {
		t.Fatal(err)
	}
	_, click := c.do("POST", "/api/referrals/clicks", `{"offerId":"demo-bank-12m"}`)
	c.do("POST", "/api/track", `{"events":[{"name":"page_view","path":"/acasa"}]}`)
	token := c.cookies[SessionCookie]

	if code, _ := c.do("DELETE", "/api/users", ""); code != 200 || c.cookies[SessionCookie] != nil {
		t.Fatalf("reset = %d %v", code, c.cookies)
	}
	if _, err := st.GetUser(ctx, id); err != store.ErrNotFound {
		t.Errorf("user = %v", err)
	}
	if evs, _ := st.ListEvents(ctx, id); len(evs) != 0 {
		t.Errorf("events = %v", evs)
	}
	if runs, _ := st.ListRuns(ctx, id); len(runs) != 0 {
		t.Errorf("runs = %v", runs)
	}
	if ref, _ := st.GetReferralByClick(ctx, click["clickId"].(string)); ref.ID == "" || ref.UserID != nil {
		t.Errorf("referral = %+v", ref)
	}
	// the old token is dead on the server too
	c.cookies[SessionCookie] = token
	if code, _ := c.do("GET", "/api/me", ""); code != 401 {
		t.Errorf("me after reset = %d", code)
	}
	if code, _ := c.do("DELETE", "/api/users", ""); code != 200 {
		t.Errorf("reset without a session = %d", code)
	}
}

func TestResetPutsTheDemoPersonaBack(t *testing.T) {
	h, st, _ := accountServer(config.Config{AllowDemoTools: true})
	ctx := context.Background()
	a, b := &client{t: t, h: h}, &client{t: t, h: h}
	a.do("POST", "/api/users", `{"demo":"maria"}`)
	b.do("POST", "/api/users", `{"demo":"maria"}`)
	a.do("POST", "/api/events", `{"type":"salary_received"}`)
	a.do("PUT", "/api/me/salary", `{"grossMonthly":9000}`)

	if code, _ := a.do("DELETE", "/api/users", ""); code != 200 {
		t.Fatalf("reset = %d", code)
	}
	if u, err := st.GetUser(ctx, "maria"); err != nil || *u.GrossMonthly != 6000 {
		t.Errorf("maria = %+v %v", u, err)
	}
	if evs, _ := st.ListEvents(ctx, "maria"); len(evs) != 0 {
		t.Errorf("events = %v", evs)
	}
	if code, _ := a.do("GET", "/api/me", ""); code != 401 {
		t.Errorf("this browser is signed out: %d", code)
	}
	if code, _ := b.do("GET", "/api/me", ""); code != 200 {
		t.Errorf("another browser as maria stays in: %d", code)
	}
}

func TestExportOverHTTP(t *testing.T) {
	h, st, _ := accountServer(config.Config{})
	c := &client{t: t, h: h}
	if code, _ := c.do("GET", "/api/me/export", ""); code != 401 {
		t.Errorf("export without a session = %d", code)
	}
	_, out := c.do("POST", "/api/users", `{"situations":["first_job"],"grossMonthly":6000,"payday":10}`)
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	if _, err := st.CreateRun(context.Background(), domain.MomentRun{UserID: out["userId"].(string), MomentID: "payslip_explained", State: domain.RunPending}); err != nil {
		t.Fatal(err)
	}

	rec := c.send("GET", "/api/me/export", "")
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("export = %d %v", rec.Code, rec.Header())
	}
	_, ex := c.do("GET", "/api/me/export", "")
	if get(ex, "user", "id") != out["userId"] || len(ex["events"].([]any)) != 1 || len(ex["momentRuns"].([]any)) == 0 {
		t.Errorf("export = %v", ex)
	}
	sessions := ex["sessions"].([]any)
	if len(sessions) != 1 || strings.Contains(jsonString(sessions), c.cookies[SessionCookie].Value) {
		t.Errorf("sessions = %v", sessions)
	}
}

func TestEmailLogin(t *testing.T) {
	h, st, box := accountServer(config.Config{})
	ctx := context.Background()
	laptop := &client{t: t, h: h}
	_, out := laptop.do("POST", "/api/users", onboarding)
	id := out["userId"].(string)
	token := laptop.cookies[SessionCookie].Value

	if code, _ := laptop.do("POST", "/api/auth/email", `{"email":"nope"}`); code != 400 {
		t.Errorf("bad email = %d", code)
	}

	// a new email goes to the account that asked; the session stays
	code, known := laptop.do("POST", "/api/auth/email", `{"email":" Ana@Example.RO"}`)
	if code != 202 || box.sent[0].To != "ana@example.ro" {
		t.Fatalf("ask = %d %v", code, box.sent)
	}
	link := box.link(t)
	rec := laptop.send("GET", link, "")
	if rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != "/acasa" || laptop.cookies[SessionCookie].Value != token {
		t.Fatalf("verify = %d %v %v", rec.Code, rec.Header(), laptop.cookies)
	}
	if _, me := laptop.do("GET", "/api/me", ""); get(me, "user", "email") != "ana@example.ro" {
		t.Errorf("me = %v", me)
	}
	// once only
	if rec := laptop.send("GET", link, ""); rec.Code != 400 {
		t.Errorf("reused link = %d", rec.Code)
	}

	// the same answer for an email nobody has
	if code, unknown := laptop.do("POST", "/api/auth/email", `{"email":"nobody@example.ro"}`); code != 202 || jsonString(unknown) != jsonString(known) {
		t.Errorf("unknown email = %d %v, known = %v", code, unknown, known)
	}

	// another device logs in to the same account
	phone := &client{t: t, h: h}
	phone.do("POST", "/api/auth/email", `{"email":"ana@example.ro"}`)
	if rec := phone.send("GET", box.link(t), ""); rec.Code != http.StatusSeeOther || phone.cookies[SessionCookie] == nil {
		t.Fatalf("phone verify = %d %v", rec.Code, phone.cookies)
	}
	if _, me := phone.do("GET", "/api/me", ""); get(me, "user", "id") != id {
		t.Errorf("phone = %v", me)
	}

	// a link someone else asked for never gives their email to your account
	stranger := &client{t: t, h: h}
	stranger.do("POST", "/api/auth/email", `{"email":"eve@example.ro"}`)
	laptop.send("GET", box.link(t), "")
	if u, _ := st.GetUser(ctx, id); *u.Email != "ana@example.ro" {
		t.Errorf("ana = %+v", u)
	}
	if eve, err := st.GetUserByEmail(ctx, "eve@example.ro"); err != nil || eve.ID == id {
		t.Errorf("eve = %+v %v", eve, err)
	}

	// a few mails per address an hour
	codes := []int{}
	for range loginMailsPerHour {
		code, _ := stranger.do("POST", "/api/auth/email", `{"email":"busy@example.ro"}`)
		codes = append(codes, code)
	}
	if code, _ := stranger.do("POST", "/api/auth/email", `{"email":"BUSY@example.ro"}`); code != 429 {
		t.Errorf("after %v: %d", codes, code)
	}
}

func TestLoginMailHasNoTokenInProductionLogs(t *testing.T) {
	var logs strings.Builder
	logger := slog.New(slog.NewTextHandler(&logs, nil))
	m := loginMail("ana@example.ro", "https://rost.test/api/auth/verify?token="+url.QueryEscape("s3cret-token"), reference.RO)
	if err := (mail.Log{Logger: logger}).Send(context.Background(), m); err != nil {
		t.Fatal(err)
	}
	if strings.Contains(logs.String(), "s3cret") || strings.Contains(logs.String(), "ana@") {
		t.Errorf("log = %s", logs.String())
	}
	logs.Reset()
	_ = (mail.Log{Logger: logger, ShowBody: true}).Send(context.Background(), m)
	if !strings.Contains(logs.String(), "s3cret") {
		t.Errorf("a dev log shows the link: %s", logs.String())
	}
}
