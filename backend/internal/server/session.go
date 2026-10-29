package server

import (
	"errors"
	"net/http"

	"rost/backend/internal/app"
	"rost/backend/internal/domain"
	"rost/backend/internal/reference"
	"rost/backend/internal/store"
)

// SessionCookie holds a random token; the server keeps only its hash (see app.StartSession).
const SessionCookie = "rost_session"

// UIDCookie held the raw user id before sessions. While Config.LegacyUIDCookie is on, a request
// with only this cookie gets a session in its place, once, for users from before sessions. Remove
// after one release.
const UIDCookie = "rost_uid"

func newUserID() string { return store.NewID() }

func (s *server) setSession(w http.ResponseWriter, token string) {
	http.SetCookie(w, &http.Cookie{
		Name: SessionCookie, Value: token, Path: "/", MaxAge: int(app.SessionTTL.Seconds()), HttpOnly: true,
		SameSite: http.SameSiteLaxMode, Secure: s.Config.CookieSecure,
	})
}

func (s *server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: SessionCookie, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteLaxMode, Secure: s.Config.CookieSecure,
	})
}

func clearUIDCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{Name: UIDCookie, Value: "", Path: "/", MaxAge: -1})
}

func cookieValue(r *http.Request, name string) string {
	if c, err := r.Cookie(name); err == nil {
		return c.Value
	}
	return ""
}

// startSession signs this browser in as userID, ending the session it had.
func (s *server) startSession(w http.ResponseWriter, r *http.Request, userID string) error {
	if err := s.svc.EndSession(r.Context(), cookieValue(r, SessionCookie)); err != nil {
		return err
	}
	token, err := s.svc.StartSession(r.Context(), userID)
	if err != nil {
		return err
	}
	s.setSession(w, token)
	return nil
}

// sessionUserID is the signed-in user's id, "" without a valid session. It sets the cookie again
// when the session's expiry moved, and swaps an old rost_uid cookie for a session.
func (s *server) sessionUserID(w http.ResponseWriter, r *http.Request) (string, error) {
	token, legacy := cookieValue(r, SessionCookie), cookieValue(r, UIDCookie)
	if token != "" {
		id, renewed, err := s.svc.SessionUser(r.Context(), token)
		switch {
		case err == nil:
			if renewed {
				s.setSession(w, token)
			}
			if legacy != "" {
				clearUIDCookie(w)
			}
			return id, nil
		case !errors.Is(err, app.ErrNoSession):
			return "", err
		}
	}
	id, err := s.upgradeLegacy(w, r, legacy)
	if id == "" && err == nil && token != "" {
		s.clearSessionCookie(w) // expired or unknown
	}
	return id, err
}

// upgradeLegacy swaps a rost_uid cookie for a session, once per user, and only for users from before
// sessions (store.TakeLegacyUID), so an id is never a password again. With the swap off, the old
// cookie is only cleared.
func (s *server) upgradeLegacy(w http.ResponseWriter, r *http.Request, uid string) (string, error) {
	if uid == "" {
		return "", nil
	}
	if !s.Config.LegacyUIDCookie {
		clearUIDCookie(w)
		return "", nil
	}
	var err error
	if reference.IsDemoUser(uid) {
		// a shared persona anyone can enter with POST /api/users, so only demo tools matter
		if !s.Config.AllowDemoTools {
			clearUIDCookie(w)
			return "", nil
		}
		_, err = s.Store.GetUser(r.Context(), uid)
	} else {
		err = s.Store.TakeLegacyUID(r.Context(), uid)
	}
	if isNotFound(err) {
		clearUIDCookie(w)
		return "", nil
	} else if err != nil {
		return "", err
	}
	if err := s.startSession(w, r, uid); err != nil {
		return "", err
	}
	clearUIDCookie(w)
	return uid, nil
}

// currentUserID is for routes that work without a session too. A store error counts as no session.
func (s *server) currentUserID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, err := s.sessionUserID(w, r)
	if err != nil {
		s.Logger.Error("session lookup failed", "path", r.URL.Path, "err", err)
	}
	return id, id != ""
}

// userID answers 401 when there is no session.
func (s *server) userID(w http.ResponseWriter, r *http.Request) (string, bool) {
	id, err := s.sessionUserID(w, r)
	if err != nil {
		s.internal(w, r, err)
		return "", false
	}
	if id == "" {
		fail(w, http.StatusUnauthorized, "no user")
	}
	return id, id != ""
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

// LangCookie holds the visitor's language ("ro" or "en"), set by the frontend's switch.
// The Next.js proxy forwards it with the session cookie, so text comes back in the same language.
const LangCookie = "rost_lang"

func langOf(r *http.Request) reference.Lang {
	c, err := r.Cookie(LangCookie)
	if err != nil {
		return reference.RO
	}
	return reference.ParseLang(c.Value)
}
