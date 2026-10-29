package storetest

import (
	"context"
	"sort"

	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

// ---- accounts ----

// another account than id has this email (caller holds the lock)
func (m *Memory) emailTaken(email *string, id string) bool {
	if email == nil {
		return false
	}
	for _, u := range m.users {
		if u.ID != id && u.Email != nil && *u.Email == *email {
			return true
		}
	}
	return false
}

func (m *Memory) GetUserByEmail(_ context.Context, email string) (domain.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, u := range m.users {
		if u.Email != nil && *u.Email == email {
			return clone(u), nil
		}
	}
	return domain.User{}, store.ErrNotFound
}

func (m *Memory) SetUserEmail(_ context.Context, id, email string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return store.ErrNotFound
	}
	if m.emailTaken(&email, id) {
		return store.ErrConflict
	}
	u.Email = &email
	m.users[id] = u
	return nil
}

func (m *Memory) DeleteUser(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return store.ErrNotFound
	}
	for k, r := range m.referrals {
		if r.UserID != nil && *r.UserID == id {
			r.UserID = nil
			m.referrals[k] = r
		}
	}
	for i, e := range m.tracking {
		if e.UserID != nil && *e.UserID == id {
			m.tracking[i].UserID = nil
		}
	}
	for k, a := range m.actions {
		if a.UserID == id {
			delete(m.actions, k)
		}
	}
	for k, r := range m.runs {
		if r.UserID == id {
			delete(m.runs, k)
		}
	}
	events := m.events[:0]
	for _, e := range m.events {
		if e.UserID != id {
			events = append(events, e)
		}
	}
	m.events = events
	completions := m.completions[:0]
	for _, c := range m.completions {
		if c.UserID != id {
			completions = append(completions, c)
		}
	}
	m.completions = completions
	for h, t := range m.loginTokens {
		if t.UserID == id || (u.Email != nil && t.Email == *u.Email) {
			delete(m.loginTokens, h)
		}
	}
	for h, x := range m.userSessions {
		if x.UserID == id {
			delete(m.userSessions, h)
		}
	}
	delete(m.users, id)
	return nil
}

func (m *Memory) ListUserTrackEvents(_ context.Context, userID string) ([]domain.TrackEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.TrackEvent{}
	for _, e := range m.tracking {
		if e.UserID != nil && *e.UserID == userID {
			out = append(out, clone(e))
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt < out[j].CreatedAt })
	return out, nil
}

// ---- sessions ----

func (m *Memory) CreateSession(_ context.Context, x domain.Session) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for h, old := range m.userSessions {
		if old.ExpiresAt < x.CreatedAt {
			delete(m.userSessions, h)
		}
	}
	if _, ok := m.users[x.UserID]; !ok {
		return store.ErrNotFound // the foreign key
	}
	if _, ok := m.userSessions[x.TokenHash]; ok {
		return store.ErrConflict
	}
	m.userSessions[x.TokenHash] = x
	return nil
}

func (m *Memory) GetSession(_ context.Context, tokenHash string) (domain.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	x, ok := m.userSessions[tokenHash]
	if !ok {
		return x, store.ErrNotFound
	}
	return x, nil
}

func (m *Memory) TouchSession(_ context.Context, tokenHash, lastSeenAt, expiresAt string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	x, ok := m.userSessions[tokenHash]
	if !ok {
		return store.ErrNotFound
	}
	x.LastSeenAt, x.ExpiresAt = lastSeenAt, expiresAt
	m.userSessions[tokenHash] = x
	return nil
}

func (m *Memory) DeleteSession(_ context.Context, tokenHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.userSessions, tokenHash)
	return nil
}

func (m *Memory) ListSessions(_ context.Context, userID string) ([]domain.Session, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	// not through clone: the hash and user id aren't in the JSON
	out := []domain.Session{}
	for _, x := range m.userSessions {
		if x.UserID == userID {
			out = append(out, x)
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt < out[j].CreatedAt })
	return out, nil
}

// ---- email login links ----

func (m *Memory) CreateLoginToken(_ context.Context, t domain.LoginToken) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for h, old := range m.loginTokens {
		if old.ExpiresAt < t.CreatedAt {
			delete(m.loginTokens, h)
		}
	}
	if _, ok := m.loginTokens[t.TokenHash]; ok {
		return store.ErrConflict
	}
	m.loginTokens[t.TokenHash] = t
	return nil
}

func (m *Memory) TakeLoginToken(_ context.Context, tokenHash string) (domain.LoginToken, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.loginTokens[tokenHash]
	if !ok {
		return t, store.ErrNotFound
	}
	delete(m.loginTokens, tokenHash)
	return t, nil
}
