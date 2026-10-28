// Package app holds the application services shared by HTTP handlers and tests.
// Every trigger (simulator, calendar, bank, user) goes through HandleEvent.
package app

import (
	"context"
	"errors"
	"fmt"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/moments"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
	"rost/backend/internal/views"
)

type Service struct{ Store store.Store }

type EventInput struct {
	UserID          string
	Type            domain.EventType
	Payload         map[string]any
	Source          domain.EventSource
	IgnoreWeeklyCap bool
}

type EventResult struct {
	Event    domain.AppEvent    `json:"event"`
	Decision moments.Decision   `json:"decision"`
	Runs     []domain.MomentRun `json:"runs"`
}

func (s Service) HandleEvent(ctx context.Context, in EventInput) (EventResult, error) {
	u, err := s.Store.GetUser(ctx, in.UserID)
	if err != nil {
		return EventResult{}, fmt.Errorf("user %s: %w", in.UserID, err)
	}
	if in.Payload == nil {
		in.Payload = map[string]any{}
	}
	ev, err := s.Store.AddEvent(ctx, domain.AppEvent{UserID: u.ID, Type: in.Type, Payload: in.Payload, Source: in.Source})
	if err != nil {
		return EventResult{}, err
	}
	runs, err := s.Store.ListRuns(ctx, u.ID)
	if err != nil {
		return EventResult{}, err
	}
	d := moments.Decide(reference.MomentDefs(), u, moments.Event{Type: ev.Type, Payload: ev.Payload, Source: ev.Source}, runs, clock.NowISO(), in.IgnoreWeeklyCap)
	out := EventResult{Event: ev, Decision: d, Runs: []domain.MomentRun{}}
	for _, id := range d.Open {
		run, err := s.Store.CreateRun(ctx, domain.MomentRun{UserID: u.ID, MomentID: id, TriggerEventID: domain.Ptr(ev.ID), State: domain.RunPending})
		if err != nil {
			return out, err
		}
		out.Runs = append(out.Runs, run)
	}
	return out, nil
}

type RunWithView struct {
	Run  domain.MomentRun   `json:"run"`
	Def  moments.Definition `json:"def"`
	View views.MomentView   `json:"view"`
}

// RunWithView loads one of the user's runs with its view, and marks a pending run started.
// It returns store.ErrNotFound when the run doesn't exist or belongs to someone else.
func (s Service) RunWithView(ctx context.Context, runID, userID string) (RunWithView, error) {
	run, err := s.Store.GetRun(ctx, runID)
	if err != nil || run.UserID != userID {
		return RunWithView{}, notFoundOr(err)
	}
	u, err := s.Store.GetUser(ctx, userID)
	if err != nil {
		return RunWithView{}, err
	}
	def, ok := reference.GetMomentDef(run.MomentID)
	if !ok {
		return RunWithView{}, store.ErrNotFound
	}
	payload := map[string]any{}
	if run.TriggerEventID != nil {
		events, err := s.Store.ListEvents(ctx, userID)
		if err != nil {
			return RunWithView{}, err
		}
		for _, e := range events {
			if e.ID == *run.TriggerEventID {
				payload = e.Payload
			}
		}
	}
	view, err := views.Build(u, payload)
	if err != nil {
		return RunWithView{}, err
	}
	if run.State == domain.RunPending {
		run.State, run.StartedAt = domain.RunStarted, domain.Ptr(clock.NowISO())
		if err := s.Store.UpdateRun(ctx, run); err != nil {
			return RunWithView{}, err
		}
	}
	return RunWithView{run, def, view}, nil
}

func notFoundOr(err error) error {
	if err == nil || errors.Is(err, store.ErrNotFound) {
		return store.ErrNotFound
	}
	return err
}

func (s Service) ownRun(ctx context.Context, runID, userID string) (domain.MomentRun, error) {
	run, err := s.Store.GetRun(ctx, runID)
	if err != nil || run.UserID != userID {
		return run, notFoundOr(err)
	}
	return run, nil
}

func (s Service) RecordGuess(ctx context.Context, runID, userID string, guess, answer float64) (domain.MomentRun, error) {
	run, err := s.ownRun(ctx, runID, userID)
	if err != nil {
		return run, err
	}
	if run.Result == nil {
		run.Result = map[string]any{}
	}
	run.Guess, run.Result["answer"] = &guess, answer
	return run, s.Store.UpdateRun(ctx, run)
}

type ActionInput struct {
	RunID, UserID, ActionType string
	Params                    map[string]any
	FollowUpDays              int
}

// firstFor marks the matching "first" as done so catch-up lists stay accurate.
var firstFor = map[string]domain.FirstDone{"payslip_explained": "payslip", "personal_inflation": "savings"}

func (s Service) CompleteWithAction(ctx context.Context, in ActionInput) (domain.Action, error) {
	run, err := s.ownRun(ctx, in.RunID, in.UserID)
	if err != nil {
		return domain.Action{}, err
	}
	now := clock.Now()
	action, err := s.Store.CreateAction(ctx, domain.Action{
		UserID:      in.UserID,
		MomentRunID: run.ID,
		Type:        in.ActionType,
		Params:      in.Params,
		Status:      domain.ActionSet,
		FollowUpAt:  clock.ISO(now.AddDate(0, 0, in.FollowUpDays)),
	})
	if err != nil {
		return action, err
	}
	run.State, run.CompletedAt = domain.RunCompleted, domain.Ptr(clock.ISO(now))
	if err := s.Store.UpdateRun(ctx, run); err != nil {
		return action, err
	}
	if first, ok := firstFor[run.MomentID]; ok {
		u, err := s.Store.GetUser(ctx, in.UserID)
		if err != nil {
			return action, err
		}
		for _, f := range u.FirstsDone {
			if f == first {
				return action, nil
			}
		}
		u.FirstsDone = append(u.FirstsDone, first)
		return action, s.Store.UpdateUser(ctx, u)
	}
	return action, nil
}

func (s Service) DueFollowUps(ctx context.Context, userID string) ([]domain.Action, error) {
	all, err := s.Store.ListActions(ctx, userID)
	if err != nil {
		return nil, err
	}
	now := clock.Now()
	due := []domain.Action{}
	for _, a := range all {
		at, err := clock.Parse(a.FollowUpAt)
		if a.Status == domain.ActionSet && err == nil && !at.After(now) {
			due = append(due, a)
		}
	}
	return due, nil
}

var ErrUnknownOffer = errors.New("unknown offer")

// TrackReferralClick records a referral click and returns its click id.
func (s Service) TrackReferralClick(ctx context.Context, offerID string, userID *string) (string, error) {
	offer, ok := reference.FindOffer(offerID)
	if !ok {
		return "", ErrUnknownOffer
	}
	clickID := store.NewID()
	_, err := s.Store.CreateReferral(ctx, domain.Referral{
		ClickID: clickID, UserID: userID, OfferID: offerID, PartnerID: offer.PartnerID, Status: domain.ReferralClicked,
	})
	return clickID, err
}

// ReferralPostback records a partner's report. A fee is earned only when a partner's account is funded.
func (s Service) ReferralPostback(ctx context.Context, clickID string, status domain.ReferralStatus) (domain.Referral, error) {
	ref, err := s.Store.GetReferralByClick(ctx, clickID)
	if err != nil {
		return ref, err
	}
	if p, ok := reference.GetPartner(ref.PartnerID); ok && status == domain.ReferralFunded {
		ref.FeeLei = p.FeePerFundedLei
	}
	ref.Status, ref.UpdatedAt = status, clock.NowISO()
	return ref, s.Store.UpdateReferral(ctx, ref)
}
