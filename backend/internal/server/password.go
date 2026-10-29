package server

import (
	"errors"
	"net/http"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/auth"
)

// Saving an account with an email and a password, and logging back into it. The errors are short
// codes the app turns into its own words.
func (s *server) passwordRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/register", s.saveAccount)
	// wrong passwords per email, on top of the per-client limit on the route
	failures := auth.NewLimiter()
	mux.HandleFunc("POST /api/auth/login", s.passwordLogin(failures))
}

type accountRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/auth/register {email, password}: the signed-in account gets them. 409 email_taken when
// another account has the email, 409 account_saved when this one already has a password.
func (s *server) saveAccount(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	var body accountRequest
	if !readJSON(w, r, &body) {
		return
	}
	u, err := s.svc.SaveAccount(r.Context(), u, body.Email, body.Password)
	switch {
	case errors.Is(err, app.ErrBadEmail):
		fail(w, http.StatusBadRequest, "invalid_email")
	case errors.Is(err, auth.ErrWeakUserPassword):
		fail(w, http.StatusBadRequest, "weak_password")
	case errors.Is(err, app.ErrEmailTaken):
		fail(w, http.StatusConflict, "email_taken")
	case errors.Is(err, app.ErrAccountSaved):
		fail(w, http.StatusConflict, "account_saved")
	case errors.Is(err, app.ErrDemoAccount):
		fail(w, http.StatusForbidden, "demo_account")
	case err != nil:
		s.internal(w, r, err)
	default:
		writeJSON(w, http.StatusOK, map[string]any{"email": u.Email})
	}
}

// POST /api/auth/login {email, password}: this browser signs into that account, leaving the one it
// was in (which stays as it was). 401 bad_login for an unknown email or a wrong password alike.
func (s *server) passwordLogin(failures *auth.Limiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body accountRequest
		if !readJSON(w, r, &body) {
			return
		}
		key := app.NormalizeEmail(body.Email)
		if err := failures.Allow(key, time.Now()); err != nil {
			fail(w, http.StatusTooManyRequests, "too_many_tries")
			return
		}
		u, err := s.svc.PasswordLogin(r.Context(), body.Email, body.Password)
		if errors.Is(err, app.ErrBadLogin) {
			failures.Fail(key, time.Now())
			fail(w, http.StatusUnauthorized, "bad_login")
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		failures.Succeed(key)
		if err := s.startSession(w, r, u.ID); err != nil {
			s.internal(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	}
}
