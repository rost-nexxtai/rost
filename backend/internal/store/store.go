// Package store keeps runtime data (users, events, moment runs, actions, referrals) in Postgres.
// Reference data stays in versioned JSON (package reference).
package store

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"

	"rost/backend/internal/domain"
)

var (
	ErrNotFound = errors.New("not found")
	// duplicate id / email
	ErrConflict = errors.New("already exists")
)

// Store is everything that changes at runtime.
type Store interface {
	CreateUser(ctx context.Context, u domain.User) (domain.User, error)
	// GetUser returns ErrNotFound for an unknown id.
	GetUser(ctx context.Context, id string) (domain.User, error)
	UpdateUser(ctx context.Context, u domain.User) error
	// only for stats
	ListUsers(ctx context.Context) ([]domain.User, error)

	AddEvent(ctx context.Context, e domain.AppEvent) (domain.AppEvent, error)
	ListEvents(ctx context.Context, userID string) ([]domain.AppEvent, error)

	CreateRun(ctx context.Context, r domain.MomentRun) (domain.MomentRun, error)
	GetRun(ctx context.Context, id string) (domain.MomentRun, error)
	UpdateRun(ctx context.Context, r domain.MomentRun) error
	// ListRuns lists one user's runs, or everyone's when userID is "", oldest first.
	ListRuns(ctx context.Context, userID string) ([]domain.MomentRun, error)

	CreateAction(ctx context.Context, a domain.Action) (domain.Action, error)
	UpdateAction(ctx context.Context, a domain.Action) error
	ListActions(ctx context.Context, userID string) ([]domain.Action, error)

	CreateReferral(ctx context.Context, r domain.Referral) (domain.Referral, error)
	GetReferralByClick(ctx context.Context, clickID string) (domain.Referral, error)
	UpdateReferral(ctx context.Context, r domain.Referral) error
	ListReferrals(ctx context.Context) ([]domain.Referral, error)

	// ResetUsers deletes everything these users did (events, runs, actions, referrals) and
	// writes their rows back from the given seed. Stage helper for the demo personas.
	ResetUsers(ctx context.Context, seed []domain.User) error

	ContentStore
	ProgressStore
	TrackingStore
	AdminStore
}

// moments + news, edited by admins
type ContentStore interface {
	// by position, then id
	ListContent(ctx context.Context, kind domain.ContentKind, withDrafts bool) ([]domain.ContentItem, error)
	GetContent(ctx context.Context, kind domain.ContentKind, id string) (domain.ContentItem, error)
	// ErrConflict if the id exists
	CreateContent(ctx context.Context, c domain.ContentItem) (domain.ContentItem, error)
	UpdateContent(ctx context.Context, c domain.ContentItem) (domain.ContentItem, error)
	DeleteContent(ctx context.Context, kind domain.ContentKind, id string) error
	// once per seedName, so admin edits survive restarts
	SeedContent(ctx context.Context, seedName string, items []domain.ContentItem) error
}

type ProgressStore interface {
	// Keeps the best attempt per user and lesson. False when an earlier attempt was as good or better.
	AddCompletion(ctx context.Context, c domain.Completion) (bool, error)
	// userID "" = everyone
	ListCompletions(ctx context.Context, userID string) ([]domain.Completion, error)
}

type TrackingStore interface {
	AddTrackEvents(ctx context.Context, events []domain.TrackEvent) error
	// from <= createdAt < to
	ListTrackEvents(ctx context.Context, fromISO, toISO string) ([]domain.TrackEvent, error)
}

type AdminStore interface {
	// ErrConflict if the email exists
	CreateAdmin(ctx context.Context, a domain.Admin) (domain.Admin, error)
	GetAdmin(ctx context.Context, id string) (domain.Admin, error)
	GetAdminByEmail(ctx context.Context, email string) (domain.Admin, error)
	ListAdmins(ctx context.Context) ([]domain.Admin, error)
	CreateAdminSession(ctx context.Context, s domain.AdminSession) error
	GetAdminSession(ctx context.Context, tokenHash string) (domain.AdminSession, error)
	DeleteAdminSession(ctx context.Context, tokenHash string) error
}

// NewID returns a random UUID (version 4).
func NewID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
