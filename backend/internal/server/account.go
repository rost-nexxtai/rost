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

// Login emails one address can get per hour.
const loginMailsPerHour = 5

// Passwordless email login. API only: the screen comes later.
func (s *server) authRoutes(mux *http.ServeMux) {
	if s.Mailer == nil {
		s.Mailer = mail.FromConfig(s.Config, s.Logger)
	}
	perEmail := auth.NewLimiter()
	perEmail.MaxFailures, perEmail.Window = loginMailsPerHour, time.Hour
	mux.HandleFunc("POST /api/auth/email", s.emailLogin(perEmail))
	mux.HandleFunc("GET /api/auth/verify", s.verifyLogin)
}

// POST /api/auth/email {email}: mails a one-time login link. The answer is the same whether the
// email has an account or not, so no one can find out who uses Rost.
func (s *server) emailLogin(perEmail *auth.Limiter) http.HandlerFunc {
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
		key := app.NormalizeEmail(body.Email)
		if err := perEmail.Allow(key, time.Now()); err != nil {
			fail(w, http.StatusTooManyRequests, "too many login emails, try again later")
			return
		}
		email, token, err := s.svc.RequestLogin(r.Context(), body.Email, userID)
		if errors.Is(err, app.ErrBadEmail) {
			fail(w, http.StatusBadRequest, err.Error())
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		perEmail.Fail(key, time.Now())
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

// GET /api/auth/verify?token= (the link in the email): signs this browser in to the email's
// account (another device), or ties a new email to the account that asked, then goes to /acasa.
func (s *server) verifyLogin(w http.ResponseWriter, r *http.Request) {
	id, err := s.svc.UseLoginLink(r.Context(), r.URL.Query().Get("token"))
	if errors.Is(err, app.ErrBadLink) {
		fail(w, http.StatusBadRequest, err.Error())
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	current, err := s.sessionUserID(w, r)
	if err != nil {
		s.internal(w, r, err)
		return
	}
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
