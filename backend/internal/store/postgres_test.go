package store_test

import (
	"context"
	"os"
	"reflect"
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

	ref, err := s.CreateReferral(ctx, domain.Referral{ClickID: store.NewID(), UserID: domain.Ptr("maria"), OfferID: "bank-b-12m", PartnerID: domain.Ptr("bank-b"), Status: domain.ReferralClicked})
	if err != nil {
		t.Fatal(err)
	}
	ref.Status, ref.FeeLei = domain.ReferralFunded, 50
	if err := s.UpdateReferral(ctx, ref); err != nil {
		t.Fatal(err)
	}
	if r, _ := s.GetReferralByClick(ctx, ref.ClickID); r.Status != domain.ReferralFunded || r.FeeLei != 50 || *r.PartnerID != "bank-b" {
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
