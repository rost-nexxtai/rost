package server

import (
	"errors"
	"net/http"
	"slices"
	"strconv"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/auth"
	"rost/backend/internal/content"
	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

// SameSite=Strict, that is our CSRF protection
const AdminCookie = "rost_admin"

func (s *server) adminRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/admin/login", s.adminLogin)
	mux.HandleFunc("POST /api/admin/logout", s.adminLogout)
	mux.HandleFunc("GET /api/admin/me", s.asAdmin(s.adminMe))

	mux.HandleFunc("GET /api/admin/admins", s.asAdmin(s.listAdmins))
	mux.HandleFunc("POST /api/admin/admins", s.asAdmin(s.createAdmin))

	mux.HandleFunc("GET /api/admin/content/{kind}", s.asAdmin(s.listContent))
	mux.HandleFunc("POST /api/admin/content/{kind}", s.asAdmin(s.createContent))
	mux.HandleFunc("GET /api/admin/content/{kind}/{id}", s.asAdmin(s.getContent))
	mux.HandleFunc("PUT /api/admin/content/{kind}/{id}", s.asAdmin(s.updateContent))
	mux.HandleFunc("DELETE /api/admin/content/{kind}/{id}", s.asAdmin(s.deleteContent))

	mux.HandleFunc("GET /api/admin/stats", s.asAdmin(s.adminStats))
}

func setAdminCookie(w http.ResponseWriter, r *http.Request, token string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name: AdminCookie, Value: token, Path: "/api/admin", MaxAge: maxAge, HttpOnly: true, SameSite: http.SameSiteStrictMode,
		Secure: r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
	})
}

type adminHandler func(w http.ResponseWriter, r *http.Request, a domain.Admin)

// 401 without a valid session
func (s *server) asAdmin(next adminHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var token string
		if c, err := r.Cookie(AdminCookie); err == nil {
			token = c.Value
		}
		a, err := s.svc.AdminForToken(r.Context(), token)
		if errors.Is(err, app.ErrNoSession) {
			fail(w, http.StatusUnauthorized, "admin login required")
			return
		}
		if err != nil {
			s.internal(w, r, err)
			return
		}
		next(w, r, a)
	}
}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *server) adminLogin(w http.ResponseWriter, r *http.Request) {
	var body credentials
	if !readJSON(w, r, &body) {
		return
	}
	key := app.NormalizeEmail(body.Email)
	if err := s.logins.Allow(key, time.Now()); err != nil {
		fail(w, http.StatusTooManyRequests, err.Error())
		return
	}
	token, a, err := s.svc.Login(r.Context(), body.Email, body.Password)
	if errors.Is(err, app.ErrBadLogin) {
		s.logins.Fail(key, time.Now())
		s.Logger.Warn("admin login failed", "email", key)
		fail(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		s.internal(w, r, err)
		return
	}
	s.logins.Succeed(key)
	s.Logger.Info("admin login", "email", a.Email)
	setAdminCookie(w, r, token, int(app.AdminSessionTTL.Seconds()))
	writeJSON(w, http.StatusOK, map[string]any{"admin": a})
}

func (s *server) adminLogout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(AdminCookie); err == nil {
		if err := s.svc.Logout(r.Context(), c.Value); err != nil {
			s.internal(w, r, err)
			return
		}
	}
	setAdminCookie(w, r, "", -1)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (s *server) adminMe(w http.ResponseWriter, r *http.Request, a domain.Admin) {
	writeJSON(w, http.StatusOK, map[string]any{"admin": a})
}

func (s *server) listAdmins(w http.ResponseWriter, r *http.Request, _ domain.Admin) {
	admins, err := s.Store.ListAdmins(r.Context())
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"admins": admins})
}

// any admin can add another one
func (s *server) createAdmin(w http.ResponseWriter, r *http.Request, by domain.Admin) {
	var body credentials
	if !readJSON(w, r, &body) {
		return
	}
	a, err := s.svc.CreateAdmin(r.Context(), body.Email, body.Password)
	switch {
	case errors.Is(err, app.ErrBadEmail), errors.Is(err, auth.ErrWeakPassword):
		fail(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, store.ErrConflict):
		fail(w, http.StatusConflict, "an admin with this email exists")
	case err != nil:
		s.internal(w, r, err)
	default:
		s.Logger.Info("admin created", "email", a.Email, "by", by.Email)
		writeJSON(w, http.StatusCreated, map[string]any{"admin": a})
	}
}

// ---- content ----

func contentKind(w http.ResponseWriter, r *http.Request) (domain.ContentKind, bool) {
	kind := domain.ContentKind(r.PathValue("kind"))
	if !slices.Contains(domain.ContentKinds, kind) {
		fail(w, http.StatusNotFound, "unknown content kind")
		return "", false
	}
	return kind, true
}

// true if it already answered
func (s *server) contentError(w http.ResponseWriter, r *http.Request, err error) bool {
	switch {
	case err == nil:
		return false
	case content.IsValidation(err):
		fail(w, http.StatusBadRequest, err.Error())
	case isNotFound(err):
		fail(w, http.StatusNotFound, "not found")
	case errors.Is(err, store.ErrConflict):
		fail(w, http.StatusConflict, "an item with this id exists")
	default:
		s.internal(w, r, err)
	}
	return true
}

// drafts included
func (s *server) listContent(w http.ResponseWriter, r *http.Request, _ domain.Admin) {
	kind, ok := contentKind(w, r)
	if !ok {
		return
	}
	items, err := s.Store.ListContent(r.Context(), kind, true)
	if s.contentError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (s *server) getContent(w http.ResponseWriter, r *http.Request, _ domain.Admin) {
	kind, ok := contentKind(w, r)
	if !ok {
		return
	}
	item, err := s.Store.GetContent(r.Context(), kind, r.PathValue("id"))
	if s.contentError(w, r, err) {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": item})
}

func (s *server) createContent(w http.ResponseWriter, r *http.Request, a domain.Admin) {
	kind, ok := contentKind(w, r)
	if !ok {
		return
	}
	var body app.ContentInput
	if !readJSON(w, r, &body) {
		return
	}
	item, err := s.svc.CreateContent(r.Context(), kind, body, a)
	if s.contentError(w, r, err) {
		return
	}
	s.Logger.Info("content created", "kind", kind, "id", item.ID, "by", a.Email)
	writeJSON(w, http.StatusCreated, map[string]any{"item": item})
}

// publish = status "published"
func (s *server) updateContent(w http.ResponseWriter, r *http.Request, a domain.Admin) {
	kind, ok := contentKind(w, r)
	if !ok {
		return
	}
	var body app.ContentInput
	if !readJSON(w, r, &body) {
		return
	}
	item, err := s.svc.UpdateContent(r.Context(), kind, r.PathValue("id"), body, a)
	if s.contentError(w, r, err) {
		return
	}
	s.Logger.Info("content updated", "kind", kind, "id", item.ID, "status", item.Status, "by", a.Email)
	writeJSON(w, http.StatusOK, map[string]any{"item": item})
}

func (s *server) deleteContent(w http.ResponseWriter, r *http.Request, a domain.Admin) {
	kind, ok := contentKind(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	if s.contentError(w, r, s.Store.DeleteContent(r.Context(), kind, id)) {
		return
	}
	s.Logger.Info("content deleted", "kind", kind, "id", id, "by", a.Email)
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// ?days=1..365, default 30
func (s *server) adminStats(w http.ResponseWriter, r *http.Request, _ domain.Admin) {
	days := 30
	if v := r.URL.Query().Get("days"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > app.MaxStatsDays {
			fail(w, http.StatusBadRequest, "days must be between 1 and 365")
			return
		}
		days = n
	}
	st, err := s.svc.Stats(r.Context(), days)
	if err != nil {
		s.internal(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, st)
}
