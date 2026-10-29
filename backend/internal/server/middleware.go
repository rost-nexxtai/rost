package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"math"
	"net"
	"net/http"
	"runtime/debug"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ---- request ids ----

type requestIDKey struct{}

const requestIDHeader = "X-Request-ID"

// requestIDFrom is the id withRequestID put on the context, or "".
func requestIDFrom(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// validRequestID: 1 to 64 letters, digits, dots, dashes or underscores, so it is safe in logs and headers.
func validRequestID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, c := range id {
		ok := c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-' || c == '_' || c == '.'
		if !ok {
			return false
		}
	}
	return true
}

func newRequestID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// withRequestID keeps a sane incoming X-Request-ID or makes one, echoes it and puts it on the context.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get(requestIDHeader)
		if !validRequestID(id) {
			id = newRequestID()
		}
		w.Header().Set(requestIDHeader, id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))
	})
}

// ---- panics ----

// wroteRecorder knows whether the response has started, so a panic after that isn't answered twice.
type wroteRecorder struct {
	http.ResponseWriter
	wrote bool
}

func (w *wroteRecorder) WriteHeader(status int) {
	w.wrote = true
	w.ResponseWriter.WriteHeader(status)
}

func (w *wroteRecorder) Write(b []byte) (int, error) {
	w.wrote = true
	return w.ResponseWriter.Write(b)
}

// recoverPanics answers 500 and logs the panic with its stack.
func recoverPanics(logger *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &wroteRecorder{ResponseWriter: w}
		defer func() {
			v := recover()
			if v == nil {
				return
			}
			if v == http.ErrAbortHandler {
				panic(v)
			}
			logger.Error("panic", "requestId", requestIDFrom(r.Context()), "method", r.Method, "path", r.URL.Path,
				"err", fmt.Sprint(v), "stack", string(debug.Stack()))
			if !rec.wrote {
				fail(rec, http.StatusInternalServerError, "internal error")
			}
		}()
		next.ServeHTTP(rec, r)
	})
}

// ---- headers ----

// apiHeaders: never sniffed, never cached. A handler may still set its own Cache-Control.
func apiHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

// ---- cross-site requests ----

// crossSiteAllowed may be changed from another site. Only routes that don't rely on the browser's
// cookies belong here.
var crossSiteAllowed = map[string]bool{
	// Partner banks call it from their servers, authenticated by POSTBACK_SECRET, not a cookie.
	// Servers send no Sec-Fetch-Site anyway; this keeps it working if a bank's client does.
	"POST /api/referrals/postback": true,
}

// refuseCrossSite turns away state-changing requests a browser marks as coming from another site.
// Requests without Sec-Fetch-Site (servers, curl, older browsers) pass, as do same-origin, same-site
// and none. The Next.js rewrite forwards the browser's headers unchanged, and the embed view and the
// mock bank only change state from the Next server, so normal traffic is same-origin or unmarked.
func refuseCrossSite(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" && !crossSiteAllowed[r.Method+" "+r.URL.Path] {
				fail(w, http.StatusForbidden, "cross-site request refused")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// ---- rate limits ----

// Per client IP. Users and quizzes fill the database, a payslip read is a paid model call,
// tracking and referral clicks are cheap but unauthenticated writes.
var rateLimits = map[string]rateLimit{
	"users":   {Per: time.Minute, Burst: 20},
	"payslip": {Per: 10 * time.Minute, Burst: 5},
	"track":   {Per: time.Minute, Burst: 60},
}

// limitedRoutes maps "METHOD /path" to its limit. Routes with the same limit share a bucket.
var limitedRoutes = map[string]string{
	"POST /api/users":            "users",
	"POST /api/quiz":             "users",
	"POST /api/payslip/read":     "payslip",
	"POST /api/track":            "track",
	"POST /api/referrals/clicks": "track",
}

// rateLimit lets Burst requests through at once, refilled at Burst per Per.
type rateLimit struct {
	Per   time.Duration
	Burst int
}

// rateLimiter is a token bucket per key, in memory (resets on restart; fine for one instance).
type rateLimiter struct {
	limit rateLimit
	now   func() time.Time

	mu      sync.Mutex
	buckets map[string]*bucket
	swept   time.Time
}

type bucket struct {
	tokens float64
	at     time.Time
}

func newRateLimiter(l rateLimit, now func() time.Time) *rateLimiter {
	return &rateLimiter{limit: l, now: now, buckets: map[string]*bucket{}}
}

// allow takes a token for key, or says how long until one is back.
func (l *rateLimiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	perToken := l.limit.Per / time.Duration(l.limit.Burst)
	burst := float64(l.limit.Burst)
	l.sweep(now)

	b, ok := l.buckets[key]
	if !ok {
		b = &bucket{tokens: burst, at: now}
		l.buckets[key] = b
	}
	b.tokens = math.Min(burst, b.tokens+float64(now.Sub(b.at))/float64(perToken))
	b.at = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	return false, time.Duration((1 - b.tokens) * float64(perToken))
}

// sweep drops the buckets that have refilled, at most once per Per.
func (l *rateLimiter) sweep(now time.Time) {
	if now.Sub(l.swept) < l.limit.Per {
		return
	}
	l.swept = now
	for k, b := range l.buckets {
		if now.Sub(b.at) >= l.limit.Per {
			delete(l.buckets, k)
		}
	}
}

// limitRoutes answers 429 with Retry-After once a client has used up its bucket on a limited route.
func limitRoutes(limiters map[string]*rateLimiter, trustProxy bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if l := limiters[r.Method+" "+r.URL.Path]; l != nil {
			if ok, wait := l.allow(clientIP(r, trustProxy)); !ok {
				w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
				fail(w, http.StatusTooManyRequests, "too many requests")
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

// newLimiters gives each limited route its group's limiter.
func newLimiters(now func() time.Time) map[string]*rateLimiter {
	groups := map[string]*rateLimiter{}
	for name, l := range rateLimits {
		groups[name] = newRateLimiter(l, now)
	}
	out := map[string]*rateLimiter{}
	for route, name := range limitedRoutes {
		out[route] = groups[name]
	}
	return out
}

// clientIP is the peer address. Behind a trusted proxy (TRUST_PROXY=true) it is the right-most
// X-Forwarded-For entry that isn't a private or loopback address: the hop our own proxies saw.
// Entries further left are written by the client and can't be trusted. If every entry is private,
// the client is on the same network and the left-most entry is it.
// The Next.js rewrite passes X-Forwarded-For through as the client sent it, so only turn this on
// when a proxy in front of Next.js (Dokploy's Traefik) writes it.
func clientIP(r *http.Request, trustProxy bool) string {
	peer := r.RemoteAddr
	if host, _, err := net.SplitHostPort(peer); err == nil {
		peer = host
	}
	if !trustProxy {
		return peer
	}
	var hops []string
	for _, v := range r.Header.Values("X-Forwarded-For") {
		for _, h := range strings.Split(v, ",") {
			if h = strings.TrimSpace(h); h != "" {
				hops = append(hops, h)
			}
		}
	}
	for i := len(hops) - 1; i >= 0; i-- {
		ip := net.ParseIP(hops[i])
		if ip == nil {
			// Not an address: the chain is broken, so trust nothing in it.
			return peer
		}
		if !ip.IsLoopback() && !ip.IsPrivate() && !ip.IsLinkLocalUnicast() || i == 0 {
			return ip.String()
		}
	}
	return peer
}
