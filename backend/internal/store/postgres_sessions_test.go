package store_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

func TestPostgresSessionsAndErasure(t *testing.T) {
	url := os.Getenv("ROST_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("ROST_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	s := store.NewPostgres(pool)
	if err := s.Migrate(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}

	// emails are unique
	email := store.NewID() + "@example.ro"
	ana, err := s.CreateUser(ctx, domain.User{ID: store.NewID(), Email: &email})
	if err != nil {
		t.Fatal(err)
	}
	if got, err := s.GetUserByEmail(ctx, email); err != nil || got.ID != ana.ID || *got.Email != email {
		t.Errorf("by email = %+v %v", got, err)
	}
	if _, err := s.GetUserByEmail(ctx, "nobody@example.ro"); err != store.ErrNotFound {
		t.Errorf("unknown email = %v", err)
	}
	bob, _ := s.CreateUser(ctx, domain.User{ID: store.NewID()})
	if err := s.SetUserEmail(ctx, bob.ID, email); err != store.ErrConflict {
		t.Errorf("taken email = %v", err)
	}
	if err := s.SetUserEmail(ctx, "nobody", "x@example.ro"); err != store.ErrNotFound {
		t.Errorf("unknown user = %v", err)
	}
	// an email is never overwritten
	if err := s.SetUserEmail(ctx, ana.ID, "other-"+email); err != store.ErrConflict {
		t.Errorf("second email = %v", err)
	}
	if got, _ := s.GetUser(ctx, ana.ID); *got.Email != email {
		t.Errorf("ana = %+v", got)
	}
	// an update keeps the email
	ana.Name = domain.Ptr("Ana")
	if err := s.UpdateUser(ctx, ana); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetUser(ctx, ana.ID); got.Email == nil || *got.Email != email {
		t.Errorf("after update = %+v", got)
	}

	// sessions, by hash; an expired one goes when the next starts
	hash := store.NewID()
	old := domain.Session{TokenHash: store.NewID(), UserID: bob.ID, CreatedAt: "2020-01-01T00:00:00.000Z", LastSeenAt: "2020-01-01T00:00:00.000Z", ExpiresAt: "2020-03-31T00:00:00.000Z"}
	if err := s.CreateSession(ctx, old); err != nil {
		t.Fatal(err)
	}
	if err := s.CreateSession(ctx, domain.Session{TokenHash: hash, UserID: ana.ID, CreatedAt: "2026-03-01T12:00:00.000Z", LastSeenAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2026-05-30T12:00:00.000Z"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSession(ctx, old.TokenHash); err != store.ErrNotFound {
		t.Errorf("expired session = %v", err)
	}
	if err := s.TouchSession(ctx, hash, "2026-03-03T12:00:00.000Z", "2026-06-01T12:00:00.000Z"); err != nil {
		t.Fatal(err)
	}
	if x, err := s.GetSession(ctx, hash); err != nil || x.UserID != ana.ID || x.LastSeenAt != "2026-03-03T12:00:00.000Z" || x.ExpiresAt != "2026-06-01T12:00:00.000Z" {
		t.Errorf("session = %+v %v", x, err)
	}
	if err := s.TouchSession(ctx, "nope", "", ""); err != store.ErrNotFound {
		t.Errorf("touch unknown = %v", err)
	}
	if list, _ := s.ListSessions(ctx, ana.ID); len(list) != 1 || list[0].TokenHash != hash {
		t.Errorf("sessions = %+v", list)
	}
	other := domain.Session{TokenHash: store.NewID(), UserID: ana.ID, CreatedAt: "2026-03-02T12:00:00.000Z", LastSeenAt: "2026-03-02T12:00:00.000Z", ExpiresAt: "2026-05-31T12:00:00.000Z"}
	if err := s.CreateSession(ctx, other); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteSession(ctx, other.TokenHash); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSession(ctx, other.TokenHash); err != store.ErrNotFound {
		t.Errorf("deleted session = %v", err)
	}

	// login links work once, with the nonce of the browser that asked
	link := domain.LoginToken{TokenHash: store.NewID(), Email: email, UserID: bob.ID, NonceHash: "nonce", CreatedAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2026-03-01T12:15:00.000Z"}
	if err := s.CreateLoginToken(ctx, link); err != nil {
		t.Fatal(err)
	}
	for _, nonce := range []string{"another", ""} {
		if _, err := s.TakeLoginToken(ctx, link.TokenHash, nonce); err != store.ErrNotFound {
			t.Errorf("take with nonce %q = %v", nonce, err)
		}
	}
	if got, err := s.TakeLoginToken(ctx, link.TokenHash, "nonce"); err != nil || got != link {
		t.Errorf("take = %+v %v", got, err)
	}
	if _, err := s.TakeLoginToken(ctx, link.TokenHash, "nonce"); err != store.ErrNotFound {
		t.Errorf("take twice = %v", err)
	}
	anon := domain.LoginToken{TokenHash: store.NewID(), Email: "x@example.ro", NonceHash: "nonce", CreatedAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2026-03-01T12:15:00.000Z"}
	if err := s.CreateLoginToken(ctx, anon); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.TakeLoginToken(ctx, anon.TokenHash, "nonce"); got.UserID != "" {
		t.Errorf("link without a session = %+v", got)
	}
	if err := s.CreateLoginToken(ctx, domain.LoginToken{TokenHash: store.NewID(), Email: "x@example.ro", UserID: "nobody", NonceHash: "nonce", CreatedAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2026-03-01T12:15:00.000Z"}); err != store.ErrNotFound {
		t.Errorf("link for an unknown user = %v", err)
	}

	// the old rost_uid swap: once, for users from before sessions only
	if err := s.TakeLegacyUID(ctx, bob.ID); err != store.ErrNotFound {
		t.Errorf("a user made after sessions = %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE users SET legacy_uid = true WHERE id = $1`, bob.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.TakeLegacyUID(ctx, bob.ID); err != nil {
		t.Errorf("legacy user = %v", err)
	}
	if err := s.TakeLegacyUID(ctx, bob.ID); err != store.ErrNotFound {
		t.Errorf("second swap = %v", err)
	}
	if err := s.TakeLegacyUID(ctx, "nobody"); err != store.ErrNotFound {
		t.Errorf("unknown user = %v", err)
	}

	// erasure: everything goes, referrals and tracking stay without the user
	ev, _ := s.AddEvent(ctx, domain.AppEvent{UserID: ana.ID, Type: domain.SalaryReceived, Source: domain.SourceSimulator})
	run, _ := s.CreateRun(ctx, domain.MomentRun{UserID: ana.ID, MomentID: "payslip_explained", TriggerEventID: &ev.ID, State: domain.RunPending})
	if _, err := s.CreateAction(ctx, domain.Action{UserID: ana.ID, MomentRunID: run.ID, Type: "x", Status: domain.ActionSet, FollowUpAt: "2026-03-08T12:00:00.000Z"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AddCompletion(ctx, domain.Completion{UserID: ana.ID, MomentID: "inflatia", Correct: 1, Total: 2, CompletedAt: "2026-03-01T12:00:00.000Z"}); err != nil {
		t.Fatal(err)
	}
	ref, _ := s.CreateReferral(ctx, domain.Referral{ClickID: store.NewID(), UserID: &ana.ID, OfferID: "demo-bank-12m", Status: domain.ReferralClicked})
	trackID := store.NewID()
	if err := s.AddTrackEvents(ctx, []domain.TrackEvent{{ID: trackID, UserID: &ana.ID, Name: "page_view", Path: "/acasa"}}); err != nil {
		t.Fatal(err)
	}
	if evs, _ := s.ListUserTrackEvents(ctx, ana.ID); len(evs) != 1 {
		t.Errorf("tracking = %+v", evs)
	}
	_ = s.CreateLoginToken(ctx, domain.LoginToken{TokenHash: "erase-me", Email: email, NonceHash: "nonce", CreatedAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2026-03-01T12:15:00.000Z"})

	if err := s.DeleteUser(ctx, ana.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetUser(ctx, ana.ID); err != store.ErrNotFound {
		t.Errorf("user = %v", err)
	}
	if err := s.DeleteUser(ctx, ana.ID); err != store.ErrNotFound {
		t.Errorf("delete twice = %v", err)
	}
	evs, _ := s.ListEvents(ctx, ana.ID)
	runs, _ := s.ListRuns(ctx, ana.ID)
	acts, _ := s.ListActions(ctx, ana.ID)
	done, _ := s.ListCompletions(ctx, ana.ID)
	sess, _ := s.ListSessions(ctx, ana.ID)
	track, _ := s.ListUserTrackEvents(ctx, ana.ID)
	if len(evs)+len(runs)+len(acts)+len(done)+len(sess)+len(track) != 0 {
		t.Errorf("left: %v %v %v %v %v %v", evs, runs, acts, done, sess, track)
	}
	if _, err := s.TakeLoginToken(ctx, "erase-me", "nonce"); err != store.ErrNotFound {
		t.Errorf("login link for the email = %v", err)
	}
	if got, err := s.GetReferralByClick(ctx, ref.ClickID); err != nil || got.UserID != nil {
		t.Errorf("referral = %+v %v", got, err)
	}

	// a demo reset keeps the persona's sessions
	mariaSession := domain.Session{TokenHash: store.NewID(), UserID: "maria", CreatedAt: "2026-03-01T12:00:00.000Z", LastSeenAt: "2026-03-01T12:00:00.000Z", ExpiresAt: "2099-01-01T00:00:00.000Z"}
	if err := s.CreateSession(ctx, mariaSession); err != nil {
		t.Fatal(err)
	}
	if err := s.ResetUsers(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSession(ctx, mariaSession.TokenHash); err != nil {
		t.Errorf("maria's session after reset = %v", err)
	}
	_ = s.DeleteSession(ctx, mariaSession.TokenHash)
	_ = s.DeleteUser(ctx, bob.ID)
	// what erasure keeps, so other tests see a clean database
	_, _ = pool.Exec(ctx, `DELETE FROM referrals WHERE click_id = $1`, ref.ClickID)
	_, _ = pool.Exec(ctx, `DELETE FROM track_events WHERE id = $1`, trackID)
}
