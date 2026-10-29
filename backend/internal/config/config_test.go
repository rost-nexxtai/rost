package config

import (
	"strings"
	"testing"
)

func TestSMTPNeedsAppURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SMTP_HOST", "smtp.example.ro")
	t.Setenv("MAIL_FROM", "Rost <login@rost.ro>")
	for _, url := range []string{"", "http://localhost:3000", "http://localhost:3000/"} {
		t.Setenv("APP_URL", url)
		if _, err := Load(); err == nil || !strings.Contains(err.Error(), "APP_URL") {
			t.Errorf("APP_URL=%q: %v", url, err)
		}
	}
	t.Setenv("APP_URL", "https://rost.ro/")
	if cfg, err := Load(); err != nil || cfg.AppURL != "https://rost.ro" {
		t.Errorf("cfg = %q %v", cfg.AppURL, err)
	}
	// only logged: localhost is fine
	t.Setenv("SMTP_HOST", "")
	t.Setenv("APP_URL", "")
	if _, err := Load(); err != nil {
		t.Errorf("without SMTP: %v", err)
	}
}
