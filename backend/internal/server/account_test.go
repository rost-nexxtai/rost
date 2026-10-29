package server

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
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
	if _, out := c.do("POST", "/api/users", onboarding); len(out) != 1 || out["ok"] != true {
		t.Errorf("the id stays on the server: %v", out)
	}
	id := c.id()

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
	if _, out := q.do("POST", "/api/quiz", quizAllNuStiu); q.cookies[SessionCookie] == nil || q.cookies[UIDCookie] != nil || out["userId"] != nil {
		t.Errorf("quiz cookies = %v, answer %v", q.cookies, out)
	}
}

func TestLegacyUIDCookie(t *testing.T) {
	h, st, _ := accountServer(config.Config{LegacyUIDCookie: true, AllowDemoTools: true})
	ctx := context.Background()
	// ana existed before sessions (migration 006 marked her); newer was made after
	for _, id := range []string{"ana", "newer"} {
		if _, err := st.CreateUser(ctx, domain.User{ID: id, Situations: []domain.Situation{}}); err != nil {
			t.Fatal(err)
		}
	}
	st.MarkLegacy("ana")
	withUID := func(id string) *client {
		return &client{t: t, h: h, cookies: map[string]*http.Cookie{UIDCookie: {Name: UIDCookie, Value: id}}}
	}

	c := withUID("ana")
	if _, out := c.do("GET", "/api/me", ""); get(out, "user", "id") != "ana" {
		t.Fatalf("me = %v", out)
	}
	if c.cookies[UIDCookie] != nil || c.cookies[SessionCookie] == nil {
		t.Fatalf("the old cookie is swapped for a session: %v", c.cookies)
	}
	if _, out := c.do("GET", "/api/me", ""); get(out, "user", "id") != "ana" {
		t.Errorf("me with the session = %v", out)
	}
	if ss, _ := st.ListSessions(ctx, "ana"); len(ss) != 1 {
		t.Errorf("one session, not one per request: %v", ss)
	}
	// a retry inside the window (a reload before the cookie arrived) lands on the same account; the
	// window closing is in app.TestLegacySwapWindow
	if again := withUID("ana"); again.id() != "ana" {
		t.Errorf("second swap = %v", again.cookies)
	}

	// an id is never a password for users made after sessions, nor for unknown ones
	for _, id := range []string{"newer", "nobody"} {
		c := withUID(id)
		if code, _ := c.do("GET", "/api/me", ""); code != 401 || c.cookies[SessionCookie] != nil || c.cookies[UIDCookie] != nil {
			t.Errorf("%s = %d %v", id, code, c.cookies)
		}
	}

	// the shared demo persona, which anyone can enter, with demo tools
	for range 2 {
		if c := withUID("maria"); c.id() != "maria" {
			t.Errorf("maria = %v", c.cookies)
		}
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

// Parallel page loads with the same old cookie all get a session for the same account.
func TestLegacySwapInParallel(t *testing.T) {
	h, st, _ := accountServer(config.Config{LegacyUIDCookie: true})
	ctx := context.Background()
	if _, err := st.CreateUser(ctx, domain.User{ID: "ana", Situations: []domain.Situation{}}); err != nil {
		t.Fatal(err)
	}
	st.MarkLegacy("ana")
	var wg sync.WaitGroup
	ids := make([]string, 8)
	for i := range ids {
		wg.Go(func() {
			req := httptest.NewRequest("GET", "/api/me", nil)
			req.AddCookie(&http.Cookie{Name: UIDCookie, Value: "ana"})
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			var out map[string]any
			_ = json.Unmarshal(rec.Body.Bytes(), &out)
			ids[i], _ = get(out, "user", "id").(string)
		})
	}
	wg.Wait()
	for i, id := range ids {
		if id != "ana" {
			t.Errorf("request %d = %q", i, id)
		}
	}
	if users, _ := st.ListUsers(ctx); len(users) != len(reference.DemoUsers())+1 {
		t.Errorf("users = %d", len(users))
	}
}

func TestDemoPersonaNeedsDemoTools(t *testing.T) {
	h, _, _ := accountServer(config.Config{})
	c := &client{t: t, h: h}
	if code, _ := c.do("POST", "/api/users", `{"demo":"maria"}`); code != 403 || c.cookies[SessionCookie] != nil {
		t.Errorf("maria without demo tools = %d %v", code, c.cookies)
	}
}

func TestSignOutKeepsTheAccount(t *testing.T) {
	h, st, _ := accountServer(config.Config{})
	ctx := context.Background()
	c := &client{t: t, h: h}
	c.do("POST", "/api/users", `{"situations":["employed"],"grossMonthly":7000}`)
	id := c.id()
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	token := c.cookies[SessionCookie]

	if code, _ := c.do("DELETE", "/api/users", ""); code != 200 || c.cookies[SessionCookie] != nil {
		t.Fatalf("sign out = %d %v", code, c.cookies)
	}
	if u, err := st.GetUser(ctx, id); err != nil || *u.GrossMonthly != 7000 {
		t.Errorf("the account stays: %+v %v", u, err)
	}
	if evs, _ := st.ListEvents(ctx, id); len(evs) != 1 {
		t.Errorf("events = %v", evs)
	}
	// the session is over on the server too
	c.cookies[SessionCookie] = token
	if code, _ := c.do("GET", "/api/me", ""); code != 401 {
		t.Errorf("me after sign-out = %d", code)
	}
	if code, _ := c.do("DELETE", "/api/users", ""); code != 200 {
		t.Errorf("sign out without a session = %d", code)
	}
}

func TestResetErasesTheUser(t *testing.T) {
	h, st, _ := accountServer(config.Config{})
	ctx := context.Background()
	c := &client{t: t, h: h}
	c.do("POST", "/api/users", `{"situations":["first_job"],"grossMonthly":6000,"payday":10}`)
	id := c.id()
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	if _, err := st.CreateRun(ctx, domain.MomentRun{UserID: id, MomentID: "payslip_explained", State: domain.RunPending}); err != nil {
		t.Fatal(err)
	}
	_, click := c.do("POST", "/api/referrals/clicks", `{"offerId":"demo-bank-12m"}`)
	c.do("POST", "/api/track", `{"events":[{"name":"page_view","path":"/acasa"}]}`)
	token := c.cookies[SessionCookie]

	if code, _ := c.do("DELETE", "/api/me", ""); code != 200 || c.cookies[SessionCookie] != nil {
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
	if code, _ := c.do("DELETE", "/api/me", ""); code != 200 {
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

	if code, _ := a.do("DELETE", "/api/me", ""); code != 200 {
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
	c.do("POST", "/api/users", `{"situations":["first_job"],"grossMonthly":6000,"payday":10}`)
	id := c.id()
	c.do("POST", "/api/events", `{"type":"salary_received"}`)
	if _, err := st.CreateRun(context.Background(), domain.MomentRun{UserID: id, MomentID: "payslip_explained", State: domain.RunPending}); err != nil {
		t.Fatal(err)
	}

	rec := c.send("GET", "/api/me/export", "")
	if rec.Code != 200 || !strings.HasPrefix(rec.Header().Get("Content-Disposition"), "attachment") {
		t.Fatalf("export = %d %v", rec.Code, rec.Header())
	}
	_, ex := c.do("GET", "/api/me/export", "")
	if get(ex, "user", "id") != id || len(ex["events"].([]any)) != 1 || len(ex["momentRuns"].([]any)) == 0 {
		t.Errorf("export = %v", ex)
	}
	sessions := ex["sessions"].([]any)
	if len(sessions) != 1 || strings.Contains(jsonString(sessions), c.cookies[SessionCookie].Value) {
		t.Errorf("sessions = %v", sessions)
	}
}

func TestEmailLogin(t *testing.T) {
	h, st, box := accountServer(config.Config{CookieSecure: true})
	ctx := context.Background()
	laptop := &client{t: t, h: h}
	laptop.do("POST", "/api/users", onboarding)
	id := laptop.id()
	token := laptop.cookies[SessionCookie].Value

	if code, _ := laptop.do("POST", "/api/auth/email", `{"email":"nope"}`); code != 400 {
		t.Errorf("bad email = %d", code)
	}

	// asking sets a nonce in this browser; the link works only with it
	code, known := laptop.do("POST", "/api/auth/email", `{"email":" Ana@Example.RO"}`)
	if code != 202 || box.sent[0].To != "ana@example.ro" {
		t.Fatalf("ask = %d %v", code, box.sent)
	}
	nonce := laptop.cookies[LoginCookie]
	if nonce == nil || !nonce.HttpOnly || !nonce.Secure || nonce.SameSite != http.SameSiteLaxMode || nonce.MaxAge != 15*60 {
		t.Fatalf("nonce cookie = %+v", nonce)
	}
	link := box.link(t)

	// opened in another browser (or by a mail scanner): nothing happens, and the link still works here
	phone := &client{t: t, h: h}
	if rec := phone.send("GET", link, ""); rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != "/acasa" || len(phone.cookies) != 0 {
		t.Fatalf("other browser = %d %v %v", rec.Code, rec.Header(), phone.cookies)
	}
	if u, _ := st.GetUser(ctx, id); u.Email != nil {
		t.Fatalf("another browser attached the email: %+v", u)
	}

	// a new email goes to the account that asked, in the browser that asked; the session stays
	rec := laptop.send("GET", link, "")
	if rec.Code != http.StatusSeeOther || rec.Header().Get("Location") != "/acasa" || laptop.cookies[SessionCookie].Value != token {
		t.Fatalf("verify = %d %v %v", rec.Code, rec.Header(), laptop.cookies)
	}
	if laptop.cookies[LoginCookie] != nil {
		t.Error("the nonce is cleared after use")
	}
	if _, me := laptop.do("GET", "/api/me", ""); get(me, "user", "email") != "ana@example.ro" {
		t.Errorf("me = %v", me)
	}
	// once only: a used link changes nothing
	laptop.cookies[LoginCookie] = nonce
	if rec := laptop.send("GET", link, ""); rec.Code != http.StatusSeeOther || laptop.cookies[SessionCookie].Value != token {
		t.Errorf("reused link = %d %v", rec.Code, laptop.cookies)
	}

	// the same answer for an email nobody has
	if code, unknown := laptop.do("POST", "/api/auth/email", `{"email":"nobody@example.ro"}`); code != 202 || jsonString(unknown) != jsonString(known) {
		t.Errorf("unknown email = %d %v, known = %v", code, unknown, known)
	}

	// another device logs in to the same account, with a link it asked for
	phone.do("POST", "/api/auth/email", `{"email":"ana@example.ro"}`)
	if rec := phone.send("GET", box.link(t), ""); rec.Code != http.StatusSeeOther || phone.cookies[SessionCookie] == nil {
		t.Fatalf("phone verify = %d %v", rec.Code, phone.cookies)
	}
	if phone.id() != id {
		t.Errorf("phone = %v", phone.id())
	}

	// an account with an email keeps it: another address gets an account of its own
	laptop.do("POST", "/api/auth/email", `{"email":"ana.work@example.ro"}`)
	laptop.send("GET", box.link(t), "")
	if u, _ := st.GetUser(ctx, id); *u.Email != "ana@example.ro" {
		t.Errorf("ana = %+v", u)
	}
	if other := laptop.id(); other == id || other == "" {
		t.Errorf("second email = %q", other)
	}
	if u, err := st.GetUserByEmail(ctx, "ana.work@example.ro"); err != nil || u.ID == id {
		t.Errorf("ana.work = %+v %v", u, err)
	}

	// a few mails per address an hour
	stranger := &client{t: t, h: h}
	codes := []int{}
	for range loginMailsPerHour {
		code, _ := stranger.do("POST", "/api/auth/email", `{"email":"busy@example.ro"}`)
		codes = append(codes, code)
	}
	if code, _ := stranger.do("POST", "/api/auth/email", `{"email":"BUSY@example.ro"}`); code != 429 {
		t.Errorf("after %v: %d", codes, code)
	}
}

// An attacker asks for a link with the victim's email: the victim opening it gets nothing from the
// attacker's account, and the attacker's account never gets the victim's email.
func TestEmailLoginNoTakeover(t *testing.T) {
	h, st, box := accountServer(config.Config{})
	ctx := context.Background()
	eve, victim := &client{t: t, h: h}, &client{t: t, h: h}
	eve.do("POST", "/api/users", onboarding)
	victim.do("POST", "/api/users", onboarding)
	eveID, victimID, victimToken := eve.id(), victim.id(), victim.cookies[SessionCookie].Value

	eve.do("POST", "/api/auth/email", `{"email":"victim@example.ro"}`)
	if rec := victim.send("GET", box.link(t), ""); rec.Code != http.StatusSeeOther || victim.cookies[SessionCookie].Value != victimToken {
		t.Fatalf("victim = %d %v", rec.Code, victim.cookies)
	}
	if victim.id() != victimID {
		t.Error("the victim was signed in to another account")
	}
	if u, _ := st.GetUser(ctx, eveID); u.Email != nil {
		t.Errorf("eve's account got the victim's email: %+v", u)
	}
	if _, err := st.GetUserByEmail(ctx, "victim@example.ro"); err == nil {
		t.Error("an account has the victim's email")
	}
}

// Login CSRF: the attacker sends the victim a link for the attacker's own account. The victim's
// session is left alone.
func TestEmailLoginNoCSRF(t *testing.T) {
	h, st, box := accountServer(config.Config{})
	ctx := context.Background()
	eve, victim := &client{t: t, h: h}, &client{t: t, h: h}
	eve.do("POST", "/api/users", onboarding)
	eve.do("POST", "/api/auth/email", `{"email":"eve@example.ro"}`)
	eve.send("GET", box.link(t), "")
	eveID := eve.id()
	if u, err := st.GetUserByEmail(ctx, "eve@example.ro"); err != nil || u.ID != eveID {
		t.Fatalf("eve = %+v %v", u, err)
	}

	victim.do("POST", "/api/users", onboarding)
	victimID, victimToken := victim.id(), victim.cookies[SessionCookie].Value
	eve.do("POST", "/api/auth/email", `{"email":"eve@example.ro"}`)
	if rec := victim.send("GET", box.link(t), ""); rec.Code != http.StatusSeeOther || victim.cookies[SessionCookie].Value != victimToken {
		t.Fatalf("victim = %d %v", rec.Code, victim.cookies)
	}
	if victim.id() != victimID {
		t.Error("the victim was signed in to eve's account")
	}
	if ss, _ := st.ListSessions(ctx, eveID); len(ss) != 1 {
		t.Errorf("eve's sessions = %v", ss)
	}
}

func TestLoginMailsHaveADailyCap(t *testing.T) {
	h, _, box := accountServer(config.Config{RateLimitsOff: true})
	ask := func(i int, addr string) int {
		return send(h, "POST", "/api/auth/email", fmt.Sprintf(`{"email":"user%d@example.ro"}`, i), map[string]string{"RemoteAddr": addr}).Code
	}
	// one client: a few a day, whatever the address
	for i := range loginMailsPerClientPerDay {
		if code := ask(i, "203.0.113.7:1234"); code != 202 {
			t.Fatalf("mail %d = %d", i, code)
		}
	}
	if code := ask(1000, "203.0.113.7:1234"); code != 429 {
		t.Errorf("over the client's day = %d", code)
	}
	// many clients: the server's day
	for i := loginMailsPerClientPerDay; i < loginMailsPerDay; i++ {
		if code := ask(i, fmt.Sprintf("198.51.100.%d:1234", i%250)); code != 202 {
			t.Fatalf("mail %d = %d", i, code)
		}
	}
	if code := ask(1001, "192.0.2.1:1234"); code != 429 || len(box.sent) != loginMailsPerDay {
		t.Errorf("over the cap = %d, %d sent", code, len(box.sent))
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

func TestDemoFlag(t *testing.T) {
	for _, on := range []bool{true, false} {
		h, _, _ := accountServer(config.Config{AllowDemoTools: on})
		if _, out := (&client{t: t, h: h}).do("GET", "/api/demo", ""); out["enabled"] != on {
			t.Errorf("demo tools %v: %v", on, out)
		}
	}
}
