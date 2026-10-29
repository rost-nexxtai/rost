package server

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/auth"
	"rost/backend/internal/mail"
	"rost/backend/internal/reference"
)

const (
	// Login emails one address can get per hour.
	loginMailsPerHour = 5
	// Login emails the whole server sends a day, so no one can run up the mail bill or our sender's name.
	loginMailsPerDay = 500
)

// LoginCookie holds a random nonce in the browser that asked for a login link; the link works only
// there (the login token keeps the nonce's hash).
const LoginCookie = "rost_login"

// Passwordless email login. API only: the screen comes later.
func (s *server) authRoutes(mux *http.ServeMux) {
	if s.Mailer == nil {
		s.Mailer = mail.FromConfig(s.Config, s.Logger)
	}
	perEmail := auth.NewLimiter()
	perEmail.MaxFailures, perEmail.Window = loginMailsPerHour, time.Hour
	all := auth.NewLimiter()
	all.MaxFailures, all.Window = loginMailsPerDay, 24*time.Hour
	mux.HandleFunc("POST /api/auth/email", s.emailLogin(perEmail, all))
	mux.HandleFunc("GET /api/auth/verify", s.verifyLogin)
}

func (s *server) setLoginCookie(w http.ResponseWriter, nonce string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: LoginCookie, Value: nonce, Path: "/api/auth", MaxAge: maxAge, HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: s.Config.CookieSecure,
	})
}

// loginNonce is this browser's login nonce: the one it has, so links it asked for earlier keep
// working, or a new one.
func loginNonce(r *http.Request) (string, error) {
	if n := cookieValue(r, LoginCookie); len(n) == 43 {
		return n, nil
	}
	n, _, err := auth.NewToken()
	return n, err
}

// POST /api/auth/email {email}: mails a one-time login link, which works only in this browser (the
// rost_login cookie). The answer is the same whether the email has an account or not, so no one can
// find out who uses Rost.
func (s *server) emailLogin(perEmail, all *auth.Limiter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Email string `json:"email"`
		}
		if !readJSON(w, r, &body) {
			return
		}
		userID, err := s.sessionUserID(w, r)
		if err != nil {
			s.internal(w, r, err)
			return
		}
		key, now := app.NormalizeEmail(body.Email), time.Now()
		if perEmail.Allow(key, now) != nil || all.Allow("all", now) != nil {
			fail(w, http.StatusTooManyRequests, "too many login emails, try again later")
			return
		}
		nonce, err := loginNonce(r)
		if err != nil {
			s.internal(w, r, err)
			return
		}
		email, token, err := s.svc.RequestLogin(r.Context(), body.Email, userID, nonce)
		if errors.Is(err, app.ErrBadEmail) {
			fail(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		perEmail.Fail(key, now)
		all.Fail("all", now)
		s.setLoginCookie(w, nonce, int(app.LoginLinkTTL.Seconds()))
		link := s.Config.AppURL + "/api/auth/verify?token=" + url.QueryEscape(token)
		if err := s.Mailer.Send(r.Context(), loginMail(email, link, langOf(r))); err != nil {
			s.internal(w, r, err)
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]bool{"ok": true})
	}
}

func loginMail(to, link string, lang reference.Lang) mail.Message {
	minutes := int(app.LoginLinkTTL.Minutes())
	if lang == reference.EN {
		return mail.Message{To: to, Subject: "Your Rost login link", Body: fmt.Sprintf(
			"Open this link to get into your Rost account:\n\n%s\n\nIt works once, for %d minutes. If you didn't ask for it, ignore this email.\n", link, minutes)}
	}
	return mail.Message{To: to, Subject: "Linkul tău de intrare în Rost", Body: fmt.Sprintf(
		"Deschide linkul ca să intri în contul tău Rost:\n\n%s\n\nMerge o singură dată, %d de minute. Dacă nu tu l-ai cerut, ignoră mesajul.\n", link, minutes)}
}

// GET /api/auth/verify?token= (the link in the email), in the browser that asked for it: signs it in
// to the email's account (another device), or ties a new email to the account that asked, or makes
// one, then goes to /acasa. In any other browser, or for a used or expired link, nothing changes and
// it only goes to /acasa.
func (s *server) verifyLogin(w http.ResponseWriter, r *http.Request) {
	current, err := s.sessionUserID(w, r)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	id, err := s.svc.UseLoginLink(r.Context(), r.URL.Query().Get("token"), cookieValue(r, LoginCookie), current)
	if errors.Is(err, app.ErrBadLink) {
		http.Redirect(w, r, "/acasa", http.StatusSeeOther)
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	s.setLoginCookie(w, "", -1)
	if current != id {
		if err := s.startSession(w, r, id); err != nil {
			s.internal(w, r, err)
			return
		}
	}
	http.Redirect(w, r, "/acasa", http.StatusSeeOther)
}

// GET /api/me/export: everything kept about the user, as a JSON file (GDPR art. 20).
func (s *server) exportMe(w http.ResponseWriter, r *http.Request) {
	u, ok := s.user(w, r)
	if !ok {
		return
	}
	out, err := s.svc.Export(r.Context(), u)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	w.Header().Set("Content-Disposition", `attachment; filename="rost-export.json"`)
	writeJSON(w, http.StatusOK, out)
}

// POST /api/me/import: the profile an old browser kept in the rost_profile cookie, sent once by the
// web app's proxy. 400 for a cookie the old app couldn't have written and 409 when the user has a
// profile already: both mean there is nothing to import. Without a session it makes the user, like
// POST /api/quiz.
func (s *server) importProfile(w http.ResponseWriter, r *http.Request) {
	var body app.LegacyProfile
	if !readJSON(w, r, &body) {
		return
	}
	userID, err := s.sessionUserID(w, r)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	out, err := s.svc.ImportLegacyProfile(r.Context(), userID, body)
	var bad app.ErrBadImport
	switch {
	case errors.As(err, &bad):
		fail(w, http.StatusBadRequest, bad.Msg)
		return
	case errors.Is(err, app.ErrHasProfile):
		fail(w, http.StatusConflict, err.Error())
		return
	case err != nil:
		s.internal(w, r, err)
		return
	}
	if out.Created {
		if err := s.startSession(w, r, out.User.ID); err != nil {
			s.internal(w, r, err)
			return
		}
	}
	writeJSON(w, http.StatusOK, map[string]bool{"imported": true})
}
