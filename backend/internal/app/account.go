package app

import (
	"context"
	"errors"
	"time"

	"rost/backend/internal/auth"
	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

// Real time, not the demo clock: moving the app clock signs no one out.
const (
	SessionTTL = 90 * 24 * time.Hour
	// a used session moves its expiry at most once a day
	sessionRenewAfter = 24 * time.Hour
	LoginLinkTTL      = 15 * time.Minute
)

var ErrBadLink = errors.New("this login link is used or expired")

func (s Service) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

// ---- sessions ----

// StartSession signs a browser in as userID. The token goes in the cookie; only its hash is kept.
func (s Service) StartSession(ctx context.Context, userID string) (string, error) {
	token, hash, err := auth.NewToken()
	if err != nil {
		return "", err
	}
	now := s.now()
	err = s.Store.CreateSession(ctx, domain.Session{
		TokenHash: hash, UserID: userID, CreatedAt: clock.ISO(now), LastSeenAt: clock.ISO(now), ExpiresAt: clock.ISO(now.Add(SessionTTL)),
	})
	return token, err
}

// SessionUser is the user behind a session token: ErrNoSession for an unknown or expired one.
// renewed says the expiry moved, so the cookie should be set again too.
func (s Service) SessionUser(ctx context.Context, token string) (userID string, renewed bool, err error) {
	if token == "" {
		return "", false, ErrNoSession
	}
	hash := auth.HashToken(token)
	x, err := s.Store.GetSession(ctx, hash)
	if errors.Is(err, store.ErrNotFound) {
		return "", false, ErrNoSession
	}
	if err != nil {
		return "", false, err
	}
	now := s.now()
	if exp, err := clock.Parse(x.ExpiresAt); err != nil || !now.Before(exp) {
		_ = s.Store.DeleteSession(ctx, hash)
		return "", false, ErrNoSession
	}
	if seen, err := clock.Parse(x.LastSeenAt); err != nil || now.Sub(seen) >= sessionRenewAfter {
		if err := s.Store.TouchSession(ctx, hash, clock.ISO(now), clock.ISO(now.Add(SessionTTL))); err != nil {
			return "", false, err
		}
		renewed = true
	}
	return x.UserID, renewed, nil
}

func (s Service) EndSession(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	return s.Store.DeleteSession(ctx, auth.HashToken(token))
}

// ---- email login ----

// RequestLogin makes a one-time login link for email and returns the email as kept (lowercase)
// and the link's token. userID is the session's user, "" without one: a new email goes to that
// account when the link is opened. The answer is the same whether the email has an account or not.
func (s Service) RequestLogin(ctx context.Context, email, userID string) (string, string, error) {
	email = NormalizeEmail(email)
	if !validEmail(email) {
		return "", "", ErrBadEmail
	}
	// a shared persona never gets an email
	if reference.IsDemoUser(userID) {
		userID = ""
	}
	token, hash, err := auth.NewToken()
	if err != nil {
		return "", "", err
	}
	now := s.now()
	err = s.Store.CreateLoginToken(ctx, domain.LoginToken{
		TokenHash: hash, Email: email, UserID: userID, CreatedAt: clock.ISO(now), ExpiresAt: clock.ISO(now.Add(LoginLinkTTL)),
	})
	return email, token, err
}

// UseLoginLink opens a login link, once, and answers the account to sign in as: the one with
// the link's email (log in on another device); else the one that asked for the link, which gets
// the email; else a new account with it. ErrBadLink for an unknown, used or expired link.
//
// A new email never goes to the account of whoever opens the link: someone could send you a link
// for their own email and so get into your account.
func (s Service) UseLoginLink(ctx context.Context, token string) (string, error) {
	if token == "" {
		return "", ErrBadLink
	}
	t, err := s.Store.TakeLoginToken(ctx, auth.HashToken(token))
	if errors.Is(err, store.ErrNotFound) {
		return "", ErrBadLink
	}
	if err != nil {
		return "", err
	}
	if exp, err := clock.Parse(t.ExpiresAt); err != nil || !s.now().Before(exp) {
		return "", ErrBadLink
	}
	byEmail := func() (string, error) {
		u, err := s.Store.GetUserByEmail(ctx, t.Email)
		return u.ID, err
	}
	id, err := byEmail()
	if err == nil || !errors.Is(err, store.ErrNotFound) {
		return id, err
	}
	if t.UserID != "" {
		err := s.Store.SetUserEmail(ctx, t.UserID, t.Email)
		switch {
		case err == nil:
			return t.UserID, nil
		case errors.Is(err, store.ErrConflict): // another link for this email won
			return byEmail()
		case !errors.Is(err, store.ErrNotFound): // not erased since: a real error
			return "", err
		}
	}
	u, err := s.Store.CreateUser(ctx, domain.User{ID: store.NewID(), Email: &t.Email, Situations: []domain.Situation{}, FirstsDone: []domain.FirstDone{}})
	if errors.Is(err, store.ErrConflict) {
		return byEmail()
	}
	return u.ID, err
}

// ---- your data ----

// EraseUser deletes the account and everything kept about it (GDPR art. 17). Referrals and
// tracking events stay without the user id: partners pay on referrals, and neither says who
// anymore. A demo persona is shared, so it goes back to its seed instead.
func (s Service) EraseUser(ctx context.Context, userID string) error {
	if reference.IsDemoUser(userID) {
		for _, u := range reference.DemoUsers() {
			if u.ID == userID {
				return s.Store.ResetUsers(ctx, []domain.User{u})
			}
		}
	}
	err := s.Store.DeleteUser(ctx, userID)
	if errors.Is(err, store.ErrNotFound) {
		return nil
	}
	return err
}

// Export is everything kept about one user (GDPR art. 20).
type Export struct {
	ExportedAt string      `json:"exportedAt"`
	User       domain.User `json:"user"`
	// signed-in browsers (the tokens themselves are never kept)
	Sessions    []domain.Session    `json:"sessions"`
	Events      []domain.AppEvent   `json:"events"`
	MomentRuns  []domain.MomentRun  `json:"momentRuns"`
	Actions     []domain.Action     `json:"actions"`
	Lessons     []domain.Completion `json:"lessons"`
	Referrals   []domain.Referral   `json:"referrals"`
	TrackEvents []domain.TrackEvent `json:"trackEvents"`
}

func (s Service) Export(ctx context.Context, u domain.User) (Export, error) {
	out := Export{ExportedAt: clock.ISO(s.now()), User: u, Referrals: []domain.Referral{}}
	var err error
	if out.Sessions, err = s.Store.ListSessions(ctx, u.ID); err != nil {
		return out, err
	}
	if out.Events, err = s.Store.ListEvents(ctx, u.ID); err != nil {
		return out, err
	}
	if out.MomentRuns, err = s.Store.ListRuns(ctx, u.ID); err != nil {
		return out, err
	}
	if out.Actions, err = s.Store.ListActions(ctx, u.ID); err != nil {
		return out, err
	}
	if out.Lessons, err = s.Store.ListCompletions(ctx, u.ID); err != nil {
		return out, err
	}
	if out.TrackEvents, err = s.Store.ListUserTrackEvents(ctx, u.ID); err != nil {
		return out, err
	}
	refs, err := s.Store.ListReferrals(ctx)
	if err != nil {
		return out, err
	}
	for _, r := range refs {
		if r.UserID != nil && *r.UserID == u.ID {
			out.Referrals = append(out.Referrals, r)
		}
	}
	return out, nil
}
