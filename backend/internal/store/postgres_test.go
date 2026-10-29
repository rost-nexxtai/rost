package store_test

import (
	"context"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

// Runs against a real Postgres when ROST_TEST_DATABASE_URL is set, e.g.
// ROST_TEST_DATABASE_URL='postgres://rost:rost@localhost:5432/rost?sslmode=disable' go test ./internal/store/
func TestPostgresRoundTrip(t *testing.T) {
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

	// Twice: migrations and the seed must be safe to re-run.
	for i := 0; i < 2; i++ {
		if err := s.Migrate(ctx, reference.DemoUsers()); err != nil {
			t.Fatalf("migrate #%d: %v", i+1, err)
		}
	}
	if err := s.ResetUsers(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}
	maria, err := s.GetUser(ctx, "maria")
	if err != nil {
		t.Fatal(err)
	}
	if *maria.GrossMonthly != 6000 || *maria.Payday != 10 || maria.Spending.Shares.Services != 0.55 || *maria.Spending.Monthly.Fuel != 400 {
		t.Errorf("maria = %+v", maria)
	}
	if _, err := s.GetUser(ctx, "nobody"); err != store.ErrNotFound {
		t.Errorf("unknown user: %v", err)
	}

	u, err := s.CreateUser(ctx, domain.User{ID: store.NewID(), Situations: []domain.Situation{domain.Student}})
	if err != nil {
		t.Fatal(err)
	}
	got, _ := s.GetUser(ctx, u.ID)
	if !reflect.DeepEqual(got.Situations, []domain.Situation{domain.Student}) || got.FirstsDone == nil || got.GrossMonthly != nil {
		t.Errorf("new user = %+v", got)
	}

	ev, err := s.AddEvent(ctx, domain.AppEvent{UserID: "maria", Type: domain.SalaryReceived, Source: domain.SourceSimulator, Payload: map[string]any{"from": "test"}})
	if err != nil {
		t.Fatal(err)
	}
	run, err := s.CreateRun(ctx, domain.MomentRun{UserID: "maria", MomentID: "payslip_explained", TriggerEventID: &ev.ID, State: domain.RunPending})
	if err != nil {
		t.Fatal(err)
	}
	run.State, run.Guess, run.Result = domain.RunStarted, domain.Ptr(300.0), map[string]any{"answer": 1500.0}
	if err := s.UpdateRun(ctx, run); err != nil {
		t.Fatal(err)
	}
	back, _ := s.GetRun(ctx, run.ID)
	if back.State != domain.RunStarted || *back.Guess != 300 || back.Result["answer"] != 1500.0 || *back.TriggerEventID != ev.ID {
		t.Errorf("run = %+v", back)
	}
	events, _ := s.ListEvents(ctx, "maria")
	if len(events) != 1 || events[0].Payload["from"] != "test" {
		t.Errorf("events = %+v", events)
	}

	a, err := s.CreateAction(ctx, domain.Action{UserID: "maria", MomentRunID: run.ID, Type: "payday_savings_rule", Params: map[string]any{"amountLei": 400.0}, Status: domain.ActionSet, FollowUpAt: "2026-11-04T00:00:00.000Z"})
	if err != nil {
		t.Fatal(err)
	}
	a.Status = domain.ActionConfirmed
	if err := s.UpdateAction(ctx, a); err != nil {
		t.Fatal(err)
	}
	actions, _ := s.ListActions(ctx, "maria")
	if len(actions) != 1 || actions[0].Status != domain.ActionConfirmed || actions[0].Params["amountLei"] != 400.0 {
		t.Errorf("actions = %+v", actions)
	}

	ref, err := s.CreateReferral(ctx, domain.Referral{ClickID: store.NewID(), UserID: domain.Ptr("maria"), OfferID: "demo-bank-12m", PartnerID: domain.Ptr("demo-bank"), Status: domain.ReferralClicked})
	if err != nil {
		t.Fatal(err)
	}
	ref.Status, ref.FeeLei = domain.ReferralFunded, 50
	if err := s.UpdateReferral(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if r, _ := s.GetReferralByClick(ctx, ref.ClickID); r.Status != domain.ReferralFunded || r.FeeLei != 50 || *r.PartnerID != "demo-bank" {
		t.Errorf("referral = %+v", r)
	}

	if err := s.ResetUsers(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}
	if runs, _ := s.ListRuns(ctx, "maria"); len(runs) != 0 {
		t.Errorf("runs after reset = %d", len(runs))
	}
	if refs, _ := s.ListReferrals(ctx); len(refs) != 0 {
		t.Errorf("referrals after reset = %d", len(refs))
	}
}

func TestPostgresContentAdminsTracking(t *testing.T) {
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
	if err := s.ResetUsers(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}
	maria, _ := s.GetUser(ctx, "maria")
	if maria.Quiz == nil || maria.Quiz.Level != 1 || maria.Quiz.BufferMonths != 0.8 || maria.LevelEarned != 0 {
		t.Errorf("maria's quiz = %+v, level earned %d", maria.Quiz, maria.LevelEarned)
	}
	maria.LevelEarned = 2
	if err := s.UpdateUser(ctx, maria); err != nil {
		t.Fatal(err)
	}
	if back, _ := s.GetUser(ctx, "maria"); back.LevelEarned != 2 {
		t.Errorf("level earned = %d", back.LevelEarned)
	}

	// seed only runs once, even after deleting
	run := store.NewID()[:8]
	id := "test_" + run
	item := domain.ContentItem{Kind: domain.KindMoment, ID: id, Status: domain.StatusDraft, Position: 5, Doc: []byte(`{"id":"` + id + `","title":"T"}`), UpdatedBy: "test"}
	seedName := "test-" + run
	if err := s.SeedContent(ctx, seedName, []domain.ContentItem{item}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateContent(ctx, item); err != store.ErrConflict {
		t.Errorf("duplicate content: %v", err)
	}
	if err := s.DeleteContent(ctx, domain.KindMoment, id); err != nil {
		t.Fatal(err)
	}
	if err := s.SeedContent(ctx, seedName, []domain.ContentItem{item}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetContent(ctx, domain.KindMoment, id); err != store.ErrNotFound {
		t.Errorf("seed ran twice: %v", err)
	}
	// A new seed version refreshes items nobody edited since the seed, and leaves edited ones alone.
	seeded := item
	seeded.ID, seeded.UpdatedBy, seeded.Doc = id+"_s", "seed", []byte(`{"id":"`+id+`_s","title":"old"}`)
	edited := seeded
	edited.ID, edited.Doc = id+"_e", []byte(`{"id":"`+id+`_e","title":"old"}`)
	if err := s.SeedContent(ctx, seedName+"-a", []domain.ContentItem{seeded, edited}); err != nil {
		t.Fatal(err)
	}
	edited.Doc, edited.UpdatedBy = []byte(`{"id":"`+id+`_e","title":"admin"}`), "admin@rost"
	if _, err := s.UpdateContent(ctx, edited); err != nil {
		t.Fatal(err)
	}
	seeded.Doc = []byte(`{"id":"` + id + `_s","title":"new"}`)
	edited.Doc, edited.UpdatedBy = []byte(`{"id":"`+id+`_e","title":"new"}`), "seed"
	if err := s.SeedContent(ctx, seedName+"-b", []domain.ContentItem{seeded, edited}); err != nil {
		t.Fatal(err)
	}
	if c, _ := s.GetContent(ctx, domain.KindMoment, id+"_s"); !strings.Contains(string(c.Doc), `"new"`) {
		t.Errorf("unedited seed item not refreshed: %s", c.Doc)
	}
	if c, _ := s.GetContent(ctx, domain.KindMoment, id+"_e"); !strings.Contains(string(c.Doc), `"admin"`) || c.UpdatedBy != "admin@rost" {
		t.Errorf("admin edit overwritten: %s by %s", c.Doc, c.UpdatedBy)
	}
	for _, x := range []string{id + "_s", id + "_e"} {
		_ = s.DeleteContent(ctx, domain.KindMoment, x)
	}

	if _, err := s.CreateContent(ctx, item); err != nil {
		t.Fatal(err)
	}
	item.Status, item.Doc = domain.StatusPublished, []byte(`{"id":"`+id+`","title":"T2"}`)
	updated, err := s.UpdateContent(ctx, item)
	if err != nil || updated.CreatedAt == "" {
		t.Fatalf("update: %+v %v", updated, err)
	}
	published, _ := s.ListContent(ctx, domain.KindMoment, false)
	found := false
	for _, c := range published {
		if c.ID == id {
			found = strings.Contains(string(c.Doc), `"T2"`)
		}
	}
	if !found {
		t.Errorf("published list misses %s", id)
	}
	if err := s.DeleteContent(ctx, domain.KindMoment, id); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteContent(ctx, domain.KindMoment, id); err != store.ErrNotFound {
		t.Errorf("delete twice: %v", err)
	}

	// completions
	c := domain.Completion{UserID: "maria", MomentID: "fondul_urgenta", Answers: []map[string]any{{"step": 0.0, "picked": 1.0}}, Correct: 0, Total: 1}
	if created, err := s.AddCompletion(ctx, c); !created || err != nil {
		t.Fatalf("completion: %v %v", created, err)
	}
	if created, err := s.AddCompletion(ctx, c); created || err != nil {
		t.Errorf("same attempt twice: %v %v", created, err)
	}
	better := c
	better.Answers, better.Correct = []map[string]any{{"step": 0.0, "picked": 0.0}}, 1
	if created, err := s.AddCompletion(ctx, better); !created || err != nil {
		t.Errorf("better attempt: %v %v", created, err)
	}
	if created, _ := s.AddCompletion(ctx, c); created {
		t.Error("a worse attempt replaced the best one")
	}
	if cs, _ := s.ListCompletions(ctx, "maria"); len(cs) != 1 || cs[0].Correct != 1 || cs[0].Answers[0]["picked"] != 0.0 {
		t.Errorf("completions = %+v", cs)
	}

	// tracking
	mariaID := "maria"
	if err := s.AddTrackEvents(ctx, []domain.TrackEvent{
		{UserID: &mariaID, Name: "page_view", Path: "/acasa", Props: map[string]any{"run": run}, CreatedAt: "2026-10-28T10:00:00.000Z"},
		{Name: "quiz_start", Props: map[string]any{"run": run, "step": 1.0}, CreatedAt: "2026-10-28T11:00:00.000Z"},
		{UserID: &mariaID, Name: "page_view", Props: map[string]any{"run": run}, CreatedAt: "2026-10-29T00:00:00.000Z"},
	}); err != nil {
		t.Fatal(err)
	}
	// filter by run, old anonymous events stay in the db
	thisRun := func(from, to string) []domain.TrackEvent {
		all, err := s.ListTrackEvents(ctx, from, to)
		if err != nil {
			t.Fatal(err)
		}
		out := []domain.TrackEvent{}
		for _, e := range all {
			if e.Props["run"] == run {
				out = append(out, e)
			}
		}
		return out
	}
	evs := thisRun("2026-10-28T00:00:00.000Z", "2026-10-29T00:00:00.000Z")
	if len(evs) != 2 || *evs[0].UserID != "maria" || evs[1].UserID != nil || evs[1].Props["step"] != 1.0 {
		t.Errorf("events = %+v", evs)
	}
	if users, _ := s.ListUsers(ctx); len(users) == 0 {
		t.Error("no users listed")
	}

	// admins
	email := "test-" + run + "@rost.ro"
	a, err := s.CreateAdmin(ctx, domain.Admin{Email: email, PasswordHash: "hash"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateAdmin(ctx, domain.Admin{Email: email, PasswordHash: "x"}); err != store.ErrConflict {
		t.Errorf("duplicate admin: %v", err)
	}
	if got, _ := s.GetAdminByEmail(ctx, email); got.ID != a.ID || got.PasswordHash != "hash" {
		t.Errorf("admin = %+v", got)
	}
	sess := domain.AdminSession{TokenHash: "h-" + run, AdminID: a.ID, ExpiresAt: "2026-10-29T00:00:00.000Z"}
	if err := s.CreateAdminSession(ctx, sess); err != nil {
		t.Fatal(err)
	}
	if got, err := s.GetAdminSession(ctx, sess.TokenHash); err != nil || got != sess {
		t.Errorf("session = %+v %v", got, err)
	}
	if err := s.DeleteAdminSession(ctx, sess.TokenHash); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetAdminSession(ctx, sess.TokenHash); err != store.ErrNotFound {
		t.Errorf("deleted session: %v", err)
	}

	// reset clears maria
	if err := s.ResetUsers(ctx, reference.DemoUsers()); err != nil {
		t.Fatal(err)
	}
	if cs, _ := s.ListCompletions(ctx, "maria"); len(cs) != 0 {
		t.Errorf("completions after reset = %d", len(cs))
	}
	if evs := thisRun("2026-10-28T00:00:00.000Z", "2026-10-30T00:00:00.000Z"); len(evs) != 1 {
		t.Errorf("events after reset = %d, want only the anonymous one", len(evs))
	}
}

func TestPostgresPartners(t *testing.T) {
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
	keys := []string{"bank:Test Bank", "broker:test"}
	t.Cleanup(func() {
		for _, k := range keys {
			_ = s.SetPartner(ctx, k, false, "")
		}
	})

	// Marking twice is fine; unmarking something unmarked is too.
	for _, k := range append(keys, keys[0]) {
		if err := s.SetPartner(ctx, k, true, "admin@rost.ro"); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.SetPartner(ctx, "bank:Nobody", false, "admin@rost.ro"); err != nil {
		t.Fatal(err)
	}
	got, err := s.ListPartners(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, k := range keys {
		if !slices.Contains(got, k) {
			t.Errorf("partners = %v, missing %s", got, k)
		}
	}
	if err := s.SetPartner(ctx, keys[0], false, "admin@rost.ro"); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.ListPartners(ctx); slices.Contains(got, keys[0]) {
		t.Errorf("still marked after unmarking: %v", got)
	}
}
