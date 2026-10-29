package app

import (
	"context"
	"errors"
	"testing"
	"time"

	"rost/backend/internal/auth"
	"rost/backend/internal/domain"
	"rost/backend/internal/store/storetest"
)

// a Service on a clock the test moves
func clocked(st *storetest.Memory) (Service, *time.Time) {
	now := time.Date(2026, 3, 1, 12, 0, 0, 0, time.UTC)
	return Service{Store: st, Now: func() time.Time { return now }}, &now
}

func TestSessionsSlideAndExpire(t *testing.T) {
	ctx := context.Background()
	st := storetest.New(domain.User{ID: "ana"})
	s, now := clocked(st)

	token, err := s.StartSession(ctx, "ana")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.GetSession(ctx, token); err == nil {
		t.Fatal("the store must keep the hash, not the token")
	}
	if id, renewed, err := s.SessionUser(ctx, token); id != "ana" || renewed || err != nil {
		t.Fatalf("fresh session = %q %v %v", id, renewed, err)
	}
	if _, _, err := s.SessionUser(ctx, "made-up"); !errors.Is(err, ErrNoSession) {
		t.Errorf("unknown token = %v", err)
	}

	// used within a day: no write; after a day: the expiry moves
	*now = now.Add(23 * time.Hour)
	if _, renewed, _ := s.SessionUser(ctx, token); renewed {
		t.Error("renewed twice in a day")
	}
	*now = now.Add(2 * time.Hour)
	if _, renewed, _ := s.SessionUser(ctx, token); !renewed {
		t.Error("not renewed after a day")
	}
	// 89 days after the renewal it still works, 90 days after the last use it doesn't
	*now = now.Add(89 * 24 * time.Hour)
	if id, _, err := s.SessionUser(ctx, token); id != "ana" || err != nil {
		t.Fatalf("still in the window = %q %v", id, err)
	}
	*now = now.Add(90 * 24 * time.Hour)
	if _, _, err := s.SessionUser(ctx, token); !errors.Is(err, ErrNoSession) {
		t.Errorf("expired = %v", err)
	}
	if _, err := st.GetSession(ctx, auth.HashToken(token)); err == nil {
		t.Error("an expired session is deleted")
	}

	token, _ = s.StartSession(ctx, "ana")
	if err := s.EndSession(ctx, token); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.SessionUser(ctx, token); !errors.Is(err, ErrNoSession) {
		t.Errorf("after sign-out = %v", err)
	}
}

func TestLoginLinks(t *testing.T) {
	ctx := context.Background()
	st := storetest.New(domain.User{ID: "ana"}, domain.User{ID: "bob"}, domain.User{ID: "cleo", Email: domain.Ptr("cleo@example.ro")}, maria(t))
	s, now := clocked(st)
	const here, elsewhere = "nonce-of-this-browser", "nonce-of-another-browser"

	if _, _, err := s.RequestLogin(ctx, "not an email", "", here); !errors.Is(err, ErrBadEmail) {
		t.Errorf("bad email = %v", err)
	}
	if _, _, err := s.RequestLogin(ctx, "ana@example.ro", "nobody", here); err == nil {
		t.Error("a link for a user that isn't there")
	}

	// a new email goes to the account that asked, lowercase, when it opens the link in the same browser
	email, token, err := s.RequestLogin(ctx, "  Ana@Example.RO ", "ana", here)
	if err != nil || email != "ana@example.ro" {
		t.Fatalf("request = %q %v", email, err)
	}
	// another browser (a mail scanner, a forwarded link) changes nothing and leaves the link usable
	for _, nonce := range []string{elsewhere, ""} {
		if _, err := s.UseLoginLink(ctx, token, nonce, "ana"); !errors.Is(err, ErrBadLink) {
			t.Errorf("nonce %q = %v", nonce, err)
		}
	}
	if u, _ := st.GetUser(ctx, "ana"); u.Email != nil {
		t.Errorf("another browser attached the email: %+v", u)
	}
	if id, err := s.UseLoginLink(ctx, token, here, "ana"); id != "ana" || err != nil {
		t.Fatalf("attach = %q %v", id, err)
	}
	if u, _ := st.GetUser(ctx, "ana"); u.Email == nil || *u.Email != "ana@example.ro" {
		t.Errorf("ana = %+v", u)
	}
	// once only
	if _, err := s.UseLoginLink(ctx, token, here, "ana"); !errors.Is(err, ErrBadLink) {
		t.Errorf("reused link = %v", err)
	}

	// an email with an account logs in to it, whoever asked
	_, token, _ = s.RequestLogin(ctx, "ana@example.ro", "bob", here)
	if id, err := s.UseLoginLink(ctx, token, here, "bob"); id != "ana" || err != nil {
		t.Errorf("log in = %q %v", id, err)
	}
	if u, _ := st.GetUser(ctx, "bob"); u.Email != nil {
		t.Errorf("bob got an email: %+v", u)
	}

	// a new email never replaces one: cleo asked with another address, so it gets an account of its own
	_, token, _ = s.RequestLogin(ctx, "cleo2@example.ro", "cleo", here)
	if id, err := s.UseLoginLink(ctx, token, here, "cleo"); id == "cleo" || id == "" || err != nil {
		t.Errorf("second email = %q %v", id, err)
	}
	if u, _ := st.GetUser(ctx, "cleo"); *u.Email != "cleo@example.ro" {
		t.Errorf("cleo = %+v", u)
	}

	// this browser switched accounts since it asked: the one signed in now gets the email, since the
	// nonce proves it's the same browser; the account that asked doesn't
	if _, err := st.CreateUser(ctx, domain.User{ID: "dan"}); err != nil {
		t.Fatal(err)
	}
	_, token, _ = s.RequestLogin(ctx, "dan@example.ro", "bob", here)
	if id, err := s.UseLoginLink(ctx, token, here, "dan"); id != "dan" || err != nil {
		t.Errorf("switched account = %q %v", id, err)
	}
	if u, _ := st.GetUser(ctx, "dan"); u.Email == nil || *u.Email != "dan@example.ro" {
		t.Errorf("dan = %+v", u)
	}
	if u, _ := st.GetUser(ctx, "bob"); u.Email != nil {
		t.Errorf("bob got an email: %+v", u)
	}
	// signed in as the demo persona now: a new account, never the persona
	_, token, _ = s.RequestLogin(ctx, "moved@example.ro", "bob", here)
	if id, err := s.UseLoginLink(ctx, token, here, "maria"); id == "bob" || id == "maria" || id == "" || err != nil {
		t.Errorf("signed in as maria = %q %v", id, err)
	}

	// without a session (or as a demo persona), a new email gets a new account
	for _, asker := range []string{"", "maria"} {
		_, token, _ = s.RequestLogin(ctx, "new-"+asker+"@example.ro", asker, here)
		id, err := s.UseLoginLink(ctx, token, here, asker)
		if err != nil || id == "" || id == "maria" {
			t.Fatalf("new account for %q = %q %v", asker, id, err)
		}
		if u, _ := st.GetUser(ctx, id); u.Email == nil || *u.Email != "new-"+asker+"@example.ro" {
			t.Errorf("new account = %+v", u)
		}
	}

	// 15 minutes
	_, token, _ = s.RequestLogin(ctx, "late@example.ro", "bob", here)
	*now = now.Add(LoginLinkTTL)
	if _, err := s.UseLoginLink(ctx, token, here, "bob"); !errors.Is(err, ErrBadLink) {
		t.Errorf("expired link = %v", err)
	}
	if u, _ := st.GetUser(ctx, "bob"); u.Email != nil {
		t.Errorf("an expired link attached an email: %+v", u)
	}
	if _, err := s.UseLoginLink(ctx, "", here, ""); !errors.Is(err, ErrBadLink) {
		t.Errorf("no token = %v", err)
	}
}

func TestEraseAndExport(t *testing.T) {
	ctx := context.Background()
	st := storetest.New(domain.User{ID: "ana", Email: domain.Ptr("ana@example.ro")}, maria(t))
	s, _ := clocked(st)

	for _, id := range []string{"ana", "maria"} {
		if _, err := s.HandleEvent(ctx, EventInput{UserID: id, Type: domain.SalaryReceived, Source: domain.SourceSimulator}); err != nil {
			t.Fatal(err)
		}
		if _, err := s.StartSession(ctx, id); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := st.CreateRun(ctx, domain.MomentRun{UserID: "ana", MomentID: "payslip_explained", State: domain.RunPending}); err != nil {
		t.Fatal(err)
	}
	click, err := s.TrackReferralClick(ctx, "demo-bank-12m", domain.Ptr("ana"))
	if err != nil {
		t.Fatal(err)
	}
	if err := s.Track(ctx, domain.Ptr("ana"), []TrackInput{{Name: "page_view", Path: "/acasa"}}); err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.RequestLogin(ctx, "ana@example.ro", "", "nonce"); err != nil {
		t.Fatal(err)
	}

	ana, _ := st.GetUser(ctx, "ana")
	ex, err := s.Export(ctx, ana)
	if err != nil {
		t.Fatal(err)
	}
	if ex.User.ID != "ana" || len(ex.Sessions) != 1 || len(ex.Events) != 1 || len(ex.MomentRuns) != 1 || len(ex.Referrals) != 1 || len(ex.TrackEvents) != 1 {
		t.Errorf("export = %+v", ex)
	}

	if err := s.EraseUser(ctx, "ana"); err != nil {
		t.Fatal(err)
	}
	if _, err := st.GetUser(ctx, "ana"); err == nil {
		t.Error("ana is still there")
	}
	if evs, _ := st.ListEvents(ctx, "ana"); len(evs) != 0 {
		t.Errorf("events = %v", evs)
	}
	if runs, _ := st.ListRuns(ctx, "ana"); len(runs) != 0 {
		t.Errorf("runs = %v", runs)
	}
	if ss, _ := st.ListSessions(ctx, "ana"); len(ss) != 0 {
		t.Errorf("sessions = %v", ss)
	}
	if ref, _ := st.GetReferralByClick(ctx, click); ref.UserID != nil || ref.OfferID != "demo-bank-12m" {
		t.Errorf("referral must stay without the user: %+v", ref)
	}
	if evs, _ := st.ListUserTrackEvents(ctx, "ana"); len(evs) != 0 {
		t.Errorf("tracking = %v", evs)
	}
	if err := s.EraseUser(ctx, "ana"); err != nil {
		t.Errorf("erasing twice = %v", err)
	}

	// the demo persona goes back to its seed and keeps its sessions
	if err := s.EraseUser(ctx, "maria"); err != nil {
		t.Fatal(err)
	}
	if u, err := st.GetUser(ctx, "maria"); err != nil || u.Name == nil || *u.Name != "Maria" {
		t.Errorf("maria = %+v %v", u, err)
	}
	if evs, _ := st.ListEvents(ctx, "maria"); len(evs) != 0 {
		t.Errorf("maria's events = %v", evs)
	}
	if ss, _ := st.ListSessions(ctx, "maria"); len(ss) != 1 {
		t.Errorf("maria's sessions = %v", ss)
	}
}

func TestLegacySwapWindow(t *testing.T) {
	ctx := context.Background()
	st := storetest.New(domain.User{ID: "old"}, domain.User{ID: "new"})
	st.MarkLegacy("old")
	s, now := clocked(st)

	if err := s.UseLegacyUID(ctx, "new"); !errors.Is(err, ErrNoSession) {
		t.Errorf("a user made after sessions = %v", err)
	}
	// the first swap, then retries (parallel requests, a lost answer) inside the window
	for _, step := range []time.Duration{0, time.Minute, LegacySwapWindow - 2*time.Minute} {
		*now = now.Add(step)
		if err := s.UseLegacyUID(ctx, "old"); err != nil {
			t.Fatalf("swap after %v = %v", step, err)
		}
	}
	// the window counts from the first swap, not the last
	*now = now.Add(2 * time.Minute)
	if err := s.UseLegacyUID(ctx, "old"); !errors.Is(err, ErrNoSession) {
		t.Errorf("after the window = %v", err)
	}
}
