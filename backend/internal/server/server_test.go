package server

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeDB struct{ err error }

func (f fakeDB) Ping(context.Context) error { return f.err }

func TestHealthAndReadiness(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	cases := []struct {
		name string
		path string
		db   fakeDB
		want int
	}{
		{"liveness ignores the database", "/healthz", fakeDB{err: errors.New("down")}, http.StatusOK},
		{"ready when postgres answers", "/readyz", fakeDB{}, http.StatusOK},
		{"not ready when postgres is down", "/readyz", fakeDB{err: errors.New("down")}, http.StatusServiceUnavailable},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			New(logger, c.db).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, c.path, nil))
			if rec.Code != c.want {
				t.Fatalf("GET %s = %d, want %d", c.path, rec.Code, c.want)
			}
		})
	}
}
