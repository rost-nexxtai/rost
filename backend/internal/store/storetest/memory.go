// Package storetest is an in-memory store.Store for tests. The API itself runs on Postgres only.
package storetest

import (
	"context"
	"encoding/json"
	"sort"
	"sync"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

type Memory struct {
	mu        sync.Mutex
	users     map[string]domain.User
	events    []domain.AppEvent
	runs      map[string]domain.MomentRun
	actions   map[string]domain.Action
	referrals map[string]domain.Referral

	content     map[string]domain.ContentItem
	seeds       map[string]bool
	completions []domain.Completion
	tracking    []domain.TrackEvent
	admins      map[string]domain.Admin
	sessions    map[string]domain.AdminSession
}

var _ store.Store = (*Memory)(nil)

// New returns an empty store holding copies of the given users.
func New(users ...domain.User) *Memory {
	m := &Memory{
		users:     map[string]domain.User{},
		runs:      map[string]domain.MomentRun{},
		actions:   map[string]domain.Action{},
		referrals: map[string]domain.Referral{},
		content:   map[string]domain.ContentItem{},
		seeds:     map[string]bool{},
		admins:    map[string]domain.Admin{},
		sessions:  map[string]domain.AdminSession{},
	}
	for _, u := range users {
		if u.CreatedAt == "" {
			u.CreatedAt = clock.NowISO()
		}
		m.users[u.ID] = clone(u)
	}
	return m
}

// clone deep-copies through JSON, like a database round trip.
func clone[T any](v T) T {
	var out T
	b, _ := json.Marshal(v)
	_ = json.Unmarshal(b, &out)
	return out
}

func (m *Memory) CreateUser(_ context.Context, u domain.User) (domain.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if u.CreatedAt == "" {
		u.CreatedAt = clock.NowISO()
	}
	m.users[u.ID] = clone(u)
	return clone(u), nil
}

func (m *Memory) GetUser(_ context.Context, id string) (domain.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return u, store.ErrNotFound
	}
	return clone(u), nil
}

func (m *Memory) UpdateUser(_ context.Context, u domain.User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.users[u.ID]; !ok {
		return store.ErrNotFound
	}
	m.users[u.ID] = clone(u)
	return nil
}

func (m *Memory) AddEvent(_ context.Context, e domain.AppEvent) (domain.AppEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	e.ID, e.CreatedAt = store.NewID(), clock.NowISO()
	m.events = append(m.events, clone(e))
	return clone(e), nil
}

func (m *Memory) ListEvents(_ context.Context, userID string) ([]domain.AppEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.AppEvent{}
	for _, e := range m.events {
		if e.UserID == userID {
			out = append(out, clone(e))
		}
	}
	return out, nil
}

func (m *Memory) CreateRun(_ context.Context, r domain.MomentRun) (domain.MomentRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r.ID, r.CreatedAt = store.NewID(), clock.NowISO()
	m.runs[r.ID] = clone(r)
	return clone(r), nil
}

func (m *Memory) GetRun(_ context.Context, id string) (domain.MomentRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.runs[id]
	if !ok {
		return r, store.ErrNotFound
	}
	return clone(r), nil
}

func (m *Memory) UpdateRun(_ context.Context, r domain.MomentRun) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.runs[r.ID]; !ok {
		return store.ErrNotFound
	}
	m.runs[r.ID] = clone(r)
	return nil
}

func sortedValues[T any](m map[string]T, keep func(T) bool, created func(T) string) []T {
	out := []T{}
	for _, v := range m {
		if keep(v) {
			out = append(out, clone(v))
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return created(out[i]) < created(out[j]) })
	return out
}

func (m *Memory) ListRuns(_ context.Context, userID string) ([]domain.MomentRun, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return sortedValues(m.runs, func(r domain.MomentRun) bool { return userID == "" || r.UserID == userID },
		func(r domain.MomentRun) string { return r.CreatedAt }), nil
}

func (m *Memory) CreateAction(_ context.Context, a domain.Action) (domain.Action, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a.ID, a.CreatedAt = store.NewID(), clock.NowISO()
	m.actions[a.ID] = clone(a)
	return clone(a), nil
}

func (m *Memory) UpdateAction(_ context.Context, a domain.Action) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cur, ok := m.actions[a.ID]
	if !ok {
		return store.ErrNotFound
	}
	cur.Status, cur.Params = a.Status, a.Params
	m.actions[a.ID] = clone(cur)
	return nil
}

func (m *Memory) ListActions(_ context.Context, userID string) ([]domain.Action, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return sortedValues(m.actions, func(a domain.Action) bool { return userID == "" || a.UserID == userID },
		func(a domain.Action) string { return a.CreatedAt }), nil
}

func (m *Memory) CreateReferral(_ context.Context, r domain.Referral) (domain.Referral, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r.ID, r.CreatedAt = store.NewID(), clock.NowISO()
	r.UpdatedAt = r.CreatedAt
	m.referrals[r.ClickID] = clone(r)
	return clone(r), nil
}

func (m *Memory) GetReferralByClick(_ context.Context, clickID string) (domain.Referral, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.referrals[clickID]
	if !ok {
		return r, store.ErrNotFound
	}
	return clone(r), nil
}

func (m *Memory) UpdateReferral(_ context.Context, r domain.Referral) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	cur, ok := m.referrals[r.ClickID]
	if !ok {
		return store.ErrNotFound
	}
	cur.Status, cur.FeeLei, cur.UpdatedAt = r.Status, r.FeeLei, r.UpdatedAt
	m.referrals[r.ClickID] = cur
	return nil
}

func (m *Memory) ListReferrals(_ context.Context) ([]domain.Referral, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return sortedValues(m.referrals, func(domain.Referral) bool { return true },
		func(r domain.Referral) string { return r.CreatedAt }), nil
}

func (m *Memory) ResetUsers(_ context.Context, seed []domain.User) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range seed {
		events := m.events[:0]
		for _, e := range m.events {
			if e.UserID != u.ID {
				events = append(events, e)
			}
		}
		m.events = events
		for id, r := range m.runs {
			if r.UserID == u.ID {
				delete(m.runs, id)
			}
		}
		for id, a := range m.actions {
			if a.UserID == u.ID {
				delete(m.actions, id)
			}
		}
		for id, r := range m.referrals {
			if r.UserID != nil && *r.UserID == u.ID {
				delete(m.referrals, id)
			}
		}
		completions := m.completions[:0]
		for _, c := range m.completions {
			if c.UserID != u.ID {
				completions = append(completions, c)
			}
		}
		m.completions = completions
		tracking := m.tracking[:0]
		for _, e := range m.tracking {
			if e.UserID == nil || *e.UserID != u.ID {
				tracking = append(tracking, e)
			}
		}
		m.tracking = tracking
		u.CreatedAt = clock.NowISO()
		m.users[u.ID] = clone(u)
	}
	return nil
}
