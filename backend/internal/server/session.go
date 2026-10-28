package server

import (
	"net/http"

	"rost/backend/internal/domain"
	"rost/backend/internal/store"
)

// UIDCookie holds the user id set at onboarding. No accounts in the MVP.
const UIDCookie = "rost_uid"

func newUserID() string { return store.NewID() }

func currentUserID(r *http.Request) (string, bool) {
	c, err := r.Cookie(UIDCookie)
	if err != nil || c.Value == "" {
		return "", false
	}
	return c.Value, true
}

func setUserID(w http.ResponseWriter, id string) {
	http.SetCookie(w, &http.Cookie{
		Name: UIDCookie, Value: id, Path: "/", MaxAge: 60 * 60 * 24 * 90, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func clearUserID(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: UIDCookie, Value: "", Path: "/", MaxAge: -1})
}

// userID answers 401 when there is no session cookie.
func (s *server) userID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, ok := currentUserID(r)
	if !ok {
		fail(w, http.StatusUnauthorized, "no user")
	}
	return id, ok
}

// user loads the session's user, answering 401 when there is no session or the user is gone.
func (s *server) user(w http.ResponseWriter, r *http.Request) (domain.User, bool) {
	id, ok := s.userID(w, r)
	if !ok {
		return domain.User{}, false
	}
	u, err := s.Store.GetUser(r.Context(), id)
	if isNotFound(err) {
		fail(w, http.StatusUnauthorized, "no user")
		return u, false
	}
	if err != nil {
		s.internal(w, r, err)
		return u, false
	}
	return u, true
}
