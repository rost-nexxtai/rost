// Package server wires HTTP routes to handlers. App routes live under /api; the request and
// response shapes match frontend/src/contract.ts.
package server

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/auth"
	"rost/backend/internal/config"
	"rost/backend/internal/mail"
	"rost/backend/internal/store"
)

// Pinger is the slice of the database pool the health check needs.
type Pinger interface {
	Ping(ctx context.Context) error
}

type Deps struct {
	Logger *slog.Logger
	DB     Pinger
	Store  store.Store
	Config config.Config
	// Mailer sends login links; nil picks one from Config (SMTP or the log).
	Mailer mail.Mailer
}

type server struct {
	Deps
	svc app.Service
	// admin login limiter
	logins *auth.Limiter
}

func New(d Deps) http.Handler {
	s := &server{Deps: d, svc: app.Service{Store: d.Store}, logins: auth.NewLimiter()}
	mux := http.NewServeMux()

	// Liveness: the process is up.
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// Readiness: the process can reach Postgres.
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := d.DB.Ping(ctx); err != nil {
			d.Logger.Warn("readiness check failed", "err", err)
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "unavailable", "database": "down"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "database": "up"})
	})

	s.routes(mux)
	// Outermost first: request id, request log, panic recovery, headers, cross-site guard, rate limits.
	var h http.Handler = mux
	if !d.Config.RateLimitsOff {
		h = limitRoutes(newLimiters(time.Now), d.Config.TrustProxy, h)
	}
	h = refuseCrossSite(h)
	h = apiHeaders(h)
	h = recoverPanics(d.Logger, h)
	h = logRequests(d.Logger, h)
	return withRequestID(h)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

type apiError struct {
	Error string `json:"error"`
	Hint  string `json:"hint,omitempty"`
}

func fail(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, apiError{Error: msg})
}

// internal logs the error and answers 500 without details.
func (s *server) internal(w http.ResponseWriter, r *http.Request, err error) {
	s.Logger.Error("request failed", "requestId", requestIDFrom(r.Context()), "method", r.Method, "path", r.URL.Path, "err", err)
	fail(w, http.StatusInternalServerError, "internal error")
}

// readJSON decodes the request body into v, answering 400 when it isn't valid JSON.
func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(v); err != nil {
		fail(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	return true
}

func isNotFound(err error) bool { return errors.Is(err, store.ErrNotFound) }

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func logRequests(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)
		logger.Info("request", "requestId", requestIDFrom(r.Context()), "method", r.Method, "path", r.URL.Path, "status", rec.status, "duration", time.Since(start))
	})
}
