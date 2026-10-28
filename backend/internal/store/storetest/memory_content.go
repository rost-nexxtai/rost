package storetest

import (
	"context"
	"sort"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

func (m *Memory) ListUsers(_ context.Context) ([]domain.User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return sortedValues(m.users, func(domain.User) bool { return true }, func(u domain.User) string { return u.CreatedAt }), nil
}

// ---- content ----

func contentKey(kind domain.ContentKind, id string) string { return string(kind) + "/" + id }

func (m *Memory) ListContent(_ context.Context, kind domain.ContentKind, withDrafts bool) ([]domain.ContentItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.ContentItem{}
	for _, c := range m.content {
		if c.Kind == kind && (withDrafts || c.Status == domain.StatusPublished) {
			out = append(out, clone(c))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Position != out[j].Position {
			return out[i].Position < out[j].Position
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (m *Memory) GetContent(_ context.Context, kind domain.ContentKind, id string) (domain.ContentItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.content[contentKey(kind, id)]
	if !ok {
		return c, store.ErrNotFound
	}
	return clone(c), nil
}

func (m *Memory) createContent(c domain.ContentItem) (domain.ContentItem, error) {
	key := contentKey(c.Kind, c.ID)
	if _, ok := m.content[key]; ok {
		return c, store.ErrConflict
	}
	c.CreatedAt = clock.NowISO()
	c.UpdatedAt = c.CreatedAt
	m.content[key] = clone(c)
	return clone(c), nil
}

func (m *Memory) CreateContent(_ context.Context, c domain.ContentItem) (domain.ContentItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.createContent(c)
}

func (m *Memory) UpdateContent(_ context.Context, c domain.ContentItem) (domain.ContentItem, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := contentKey(c.Kind, c.ID)
	cur, ok := m.content[key]
	if !ok {
		return c, store.ErrNotFound
	}
	c.CreatedAt, c.UpdatedAt = cur.CreatedAt, clock.NowISO()
	m.content[key] = clone(c)
	return clone(c), nil
}

func (m *Memory) DeleteContent(_ context.Context, kind domain.ContentKind, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := contentKey(kind, id)
	if _, ok := m.content[key]; !ok {
		return store.ErrNotFound
	}
	delete(m.content, key)
	return nil
}

func (m *Memory) SeedContent(_ context.Context, seedName string, items []domain.ContentItem) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.seeds[seedName] {
		return nil
	}
	m.seeds[seedName] = true
	for _, c := range items {
		if _, err := m.createContent(c); err != nil && err != store.ErrConflict {
			return err
		}
	}
	return nil
}

// ---- library progress ----

func (m *Memory) AddCompletion(_ context.Context, c domain.Completion) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if c.CompletedAt == "" {
		c.CompletedAt = clock.NowISO()
	}
	if c.Answers == nil {
		c.Answers = []map[string]any{}
	}
	for i, x := range m.completions {
		if x.UserID == c.UserID && x.MomentID == c.MomentID {
			if x.Correct >= c.Correct {
				return false, nil
			}
			m.completions[i] = clone(c)
			return true, nil
		}
	}
	m.completions = append(m.completions, clone(c))
	return true, nil
}

func (m *Memory) ListCompletions(_ context.Context, userID string) ([]domain.Completion, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.Completion{}
	for _, c := range m.completions {
		if userID == "" || c.UserID == userID {
			out = append(out, clone(c))
		}
	}
	return out, nil
}

// ---- tracking ----

func (m *Memory) AddTrackEvents(_ context.Context, events []domain.TrackEvent) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, e := range events {
		if e.ID == "" {
			e.ID = store.NewID()
		}
		if e.CreatedAt == "" {
			e.CreatedAt = clock.NowISO()
		}
		if e.Props == nil {
			e.Props = map[string]any{}
		}
		m.tracking = append(m.tracking, clone(e))
	}
	return nil
}

func (m *Memory) ListTrackEvents(_ context.Context, fromISO, toISO string) ([]domain.TrackEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := []domain.TrackEvent{}
	for _, e := range m.tracking {
		if e.CreatedAt >= fromISO && e.CreatedAt < toISO {
			out = append(out, clone(e))
		}
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].CreatedAt < out[j].CreatedAt })
	return out, nil
}

// ---- admins ----

func (m *Memory) CreateAdmin(_ context.Context, a domain.Admin) (domain.Admin, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, x := range m.admins {
		if x.Email == a.Email {
			return a, store.ErrConflict
		}
	}
	a.ID, a.CreatedAt = store.NewID(), clock.NowISO()
	m.admins[a.ID] = a
	return a, nil
}

func (m *Memory) GetAdmin(_ context.Context, id string) (domain.Admin, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.admins[id]
	if !ok {
		return a, store.ErrNotFound
	}
	return a, nil
}

func (m *Memory) GetAdminByEmail(_ context.Context, email string) (domain.Admin, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, a := range m.admins {
		if a.Email == email {
			return a, nil
		}
	}
	return domain.Admin{}, store.ErrNotFound
}

func (m *Memory) ListAdmins(_ context.Context) ([]domain.Admin, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return sortedValues(m.admins, func(domain.Admin) bool { return true }, func(a domain.Admin) string { return a.CreatedAt }), nil
}

func (m *Memory) CreateAdminSession(_ context.Context, s domain.AdminSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[s.TokenHash] = s
	return nil
}

func (m *Memory) GetAdminSession(_ context.Context, tokenHash string) (domain.AdminSession, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s, ok := m.sessions[tokenHash]
	if !ok {
		return s, store.ErrNotFound
	}
	return s, nil
}

func (m *Memory) DeleteAdminSession(_ context.Context, tokenHash string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, tokenHash)
	return nil
}
