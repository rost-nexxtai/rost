package auth

import (
	"strings"
	"testing"
	"time"
)

func TestPasswordRoundTrip(t *testing.T) {
	if _, err := HashPassword("short"); err != ErrWeakPassword {
		t.Errorf("short password: %v", err)
	}
	hash, err := HashPassword("corect-cal-baterie")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "pbkdf2-sha256$600000$") {
		t.Errorf("hash = %s", hash)
	}
	if !CheckPassword(hash, "corect-cal-baterie") {
		t.Error("right password rejected")
	}
	for _, bad := range []string{"corect-cal-baterii", "", "corect-cal-baterie "} {
		if CheckPassword(hash, bad) {
			t.Errorf("wrong password %q accepted", bad)
		}
	}
	for _, broken := range []string{"", "plain", "md5$1$a$b", "pbkdf2-sha256$x$a$b"} {
		if CheckPassword(broken, "corect-cal-baterie") {
			t.Errorf("broken hash %q accepted", broken)
		}
	}
	other, _ := HashPassword("corect-cal-baterie")
	if other == hash {
		t.Error("two hashes of one password share a salt")
	}
}

func TestTokens(t *testing.T) {
	token, hash, err := NewToken()
	if err != nil {
		t.Fatal(err)
	}
	if HashToken(token) != hash || len(hash) != 64 || strings.Contains(hash, token) {
		t.Errorf("token %s hash %s", token, hash)
	}
	again, _, _ := NewToken()
	if again == token {
		t.Error("tokens repeat")
	}
}

func TestLimiter(t *testing.T) {
	l := NewLimiter()
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	for i := 0; i < l.MaxFailures; i++ {
		if err := l.Allow("a@rost.ro", now); err != nil {
			t.Fatalf("attempt %d blocked", i+1)
		}
		l.Fail("a@rost.ro", now)
	}
	if l.Allow("a@rost.ro", now) != ErrTooManyAttempts {
		t.Error("not blocked after max failures")
	}
	if l.Allow("b@rost.ro", now) != nil {
		t.Error("another email blocked")
	}
	if l.Allow("a@rost.ro", now.Add(l.Window)) != nil {
		t.Error("still blocked after the window")
	}
	l.Fail("a@rost.ro", now)
	l.Succeed("a@rost.ro")
	if len(l.failures) != 0 {
		t.Errorf("failures kept after success: %v", l.failures)
	}
}

func TestLimiterForgetsOldKeys(t *testing.T) {
	l := NewLimiter()
	now := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	for _, key := range []string{"a@rost.ro", "b@rost.ro", "c@rost.ro"} {
		l.Fail(key, now)
	}
	l.Fail("d@rost.ro", now.Add(l.Window))
	if len(l.failures) != 1 || l.failures["d@rost.ro"] == nil {
		t.Errorf("keys not seen for a window stay: %v", l.failures)
	}
}
