// Package auth: admin passwords, session tokens, login limiter.
package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// OWASP value for pbkdf2-sha256
const Iterations = 600_000

const (
	saltBytes         = 16
	keyBytes          = 32
	MinPasswordLength = 12
)

var ErrWeakPassword = fmt.Errorf("password must be at least %d characters", MinPasswordLength)

var b64 = base64.RawStdEncoding

// format: pbkdf2-sha256$iter$salt$key
func HashPassword(password string) (string, error) {
	if len([]rune(password)) < MinPasswordLength {
		return "", ErrWeakPassword
	}
	salt := make([]byte, saltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, err := pbkdf2.Key(sha256.New, password, salt, Iterations, keyBytes)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("pbkdf2-sha256$%d$%s$%s", Iterations, b64.EncodeToString(salt), b64.EncodeToString(key)), nil
}

// constant time compare
func CheckPassword(hash, password string) bool {
	parts := strings.Split(hash, "$")
	if len(parts) != 4 || parts[0] != "pbkdf2-sha256" {
		return false
	}
	iter, err := strconv.Atoi(parts[1])
	if err != nil || iter < 1 {
		return false
	}
	salt, err1 := b64.DecodeString(parts[2])
	want, err2 := b64.DecodeString(parts[3])
	if err1 != nil || err2 != nil {
		return false
	}
	got, err := pbkdf2.Key(sha256.New, password, salt, iter, len(want))
	return err == nil && subtle.ConstantTimeCompare(got, want) == 1
}

// token -> cookie, hash -> db
func NewToken() (token, hash string, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", "", err
	}
	token = base64.RawURLEncoding.EncodeToString(b)
	return token, HashToken(token), nil
}

func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

var ErrTooManyAttempts = errors.New("too many failed attempts, try again later")

// in memory, resets on restart (ok for one instance)
type Limiter struct {
	MaxFailures int
	Window      time.Duration

	mu       sync.Mutex
	failures map[string][]time.Time
	swept    time.Time
}

func NewLimiter() *Limiter {
	return &Limiter{MaxFailures: 5, Window: 15 * time.Minute, failures: map[string][]time.Time{}}
}

func (l *Limiter) recent(key string, now time.Time) []time.Time {
	kept := l.failures[key][:0]
	for _, t := range l.failures[key] {
		if now.Sub(t) < l.Window {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.failures, key)
		return nil
	}
	l.failures[key] = kept
	return kept
}

// sweep drops the keys with nothing left in the window, at most once per window, so keys seen
// once don't pile up (caller holds the lock).
func (l *Limiter) sweep(now time.Time) {
	if now.Sub(l.swept) < l.Window {
		return
	}
	l.swept = now
	for key, times := range l.failures {
		if len(times) == 0 || now.Sub(times[len(times)-1]) >= l.Window {
			delete(l.failures, key)
		}
	}
}

func (l *Limiter) Allow(key string, now time.Time) error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweep(now)
	if len(l.recent(key, now)) >= l.MaxFailures {
		return ErrTooManyAttempts
	}
	return nil
}

func (l *Limiter) Fail(key string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.sweep(now)
	l.failures[key] = append(l.recent(key, now), now)
}

func (l *Limiter) Succeed(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, key)
}
