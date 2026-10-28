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

var ErrNotFound = errors.New("not found")

// Store is everything that changes at runtime.
type Store interface {
	CreateUser(ctx context.Context, u domain.User) (domain.User, error)
	// GetUser returns ErrNotFound for an unknown id.
	GetUser(ctx context.Context, id string) (domain.User, error)
	UpdateUser(ctx context.Context, u domain.User) error

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
}

// NewID returns a random UUID (version 4).
func NewID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
