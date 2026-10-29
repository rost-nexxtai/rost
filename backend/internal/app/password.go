package app

import (
	"context"
	"errors"

	"rost/backend/internal/auth"
	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

var (
	// ErrEmailTaken: another account already has this email; its owner logs in instead.
	ErrEmailTaken = errors.New("an account with this email already exists")
	// ErrAccountSaved: this account already has an email and a password.
	ErrAccountSaved = errors.New("this account is already saved")
	// ErrDemoAccount: the shared demo persona can't be saved under someone's email.
	ErrDemoAccount = errors.New("the demo account can't be saved")
)

// a real hash of nothing, checked when the email is unknown or has no password, so every wrong
// answer takes as long (and ErrBadLogin is the same for all, so none can be probed)
func checkNothing(password string) {
	dummyOnce.Do(func() { dummyHash, _ = auth.HashPassword("not-a-real-password") })
	auth.CheckPassword(dummyHash, password)
}

// SaveAccount gives the signed-in (anonymous) account an email and a password, so it can be opened
// again on any device. An account that got its email from a login link can still add a password.
func (s Service) SaveAccount(ctx context.Context, u domain.User, email, password string) (domain.User, error) {
	if reference.IsDemoUser(u.ID) {
		return u, ErrDemoAccount
	}
	email = NormalizeEmail(email)
	if !validEmail(email) {
		return u, ErrBadEmail
	}
	have, err := s.Store.PasswordHash(ctx, u.ID)
	if err != nil {
		return u, err
	}
	if have != "" || (u.Email != nil && *u.Email != email) {
		return u, ErrAccountSaved
	}
	hash, err := auth.HashUserPassword(password)
	if err != nil {
		return u, err
	}
	if u.Email == nil {
		switch err := s.Store.SetUserEmail(ctx, u.ID, email); {
		case errors.Is(err, store.ErrConflict):
			return u, ErrEmailTaken
		case err != nil:
			return u, err
		}
		u.Email = &email
	}
	if err := s.Store.SetPasswordHash(ctx, u.ID, hash); err != nil {
		return u, err
	}
	return u, s.Store.AddTrackEvents(ctx, []domain.TrackEvent{serverEvent(u.ID, "account_saved", nil)})
}

// PasswordLogin finds the account for an email and password.
func (s Service) PasswordLogin(ctx context.Context, email, password string) (domain.User, error) {
	u, err := s.Store.GetUserByEmail(ctx, NormalizeEmail(email))
	if errors.Is(err, store.ErrNotFound) {
		checkNothing(password)
		return u, ErrBadLogin
	}
	if err != nil {
		return u, err
	}
	hash, err := s.Store.PasswordHash(ctx, u.ID)
	if err != nil {
		return u, err
	}
	if hash == "" {
		checkNothing(password)
		return u, ErrBadLogin
	}
	if !auth.CheckPassword(hash, password) {
		return u, ErrBadLogin
	}
	return u, nil
}
