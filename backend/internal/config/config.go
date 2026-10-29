// Package config reads the API's settings from the environment.
package config

import (
	"errors"
	"os"
	"strings"
	"time"
)

type Config struct {
	// HTTPAddr is where the API listens, e.g. ":8080".
	HTTPAddr string
	// DatabaseURL is a Postgres connection string.
	DatabaseURL string
	// ShutdownTimeout bounds how long in-flight requests get on SIGTERM.
	ShutdownTimeout time.Duration
	// AllowDemoTools turns on the stage helpers: the demo partner token, the app clock and the demo reset.
	// Keep it off in production.
	AllowDemoTools bool
	// PostbackSecret, when set, must be sent by partners in the x-postback-secret header.
	PostbackSecret string
	// AnthropicAPIKey and PayslipModel turn on payslip photo reading. Both are optional.
	AnthropicAPIKey string
	PayslipModel    string
	// first admin, created on start (both or none)
	AdminEmail    string
	AdminPassword string

	// Hardening.
	// TrustProxy: the API sits behind our own proxy, which writes the client's address into
	// X-Forwarded-For. Rate limits then key on that address instead of the proxy's.
	TrustProxy bool
	// RateLimitsOff turns the per-client rate limits off, e.g. for a stage demo behind one address.
	RateLimitsOff bool
	// CookieSecure marks the session cookie Secure. Turn it on when the app is served over HTTPS.
	CookieSecure bool
	// LegacyUIDCookie swaps the old rost_uid cookie (the raw user id) for a session, so users from
	// before sessions keep their account. On by default; turn it off after one release.
	LegacyUIDCookie bool
	// AppURL is where users open the app, for links in emails, e.g. "https://rost.ro".
	AppURL string
	// SMTP for login emails. Without SMTPHost, emails are only logged.
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	MailFrom     string
}

func Load() (Config, error) {
	cfg := Config{
		HTTPAddr:        getenv("HTTP_ADDR", ":8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		ShutdownTimeout: 10 * time.Second,
		AllowDemoTools:  os.Getenv("ALLOW_DEMO_TOKEN") == "true",
		PostbackSecret:  os.Getenv("POSTBACK_SECRET"),
		AnthropicAPIKey: os.Getenv("ANTHROPIC_API_KEY"),
		PayslipModel:    os.Getenv("PAYSLIP_MODEL"),
		AdminEmail:      os.Getenv("ADMIN_EMAIL"),
		AdminPassword:   os.Getenv("ADMIN_PASSWORD"),

		TrustProxy:      os.Getenv("TRUST_PROXY") == "true",
		RateLimitsOff:   os.Getenv("RATE_LIMITS") == "off",
		CookieSecure:    os.Getenv("COOKIE_SECURE") == "true",
		LegacyUIDCookie: os.Getenv("LEGACY_UID_COOKIE") != "false",
		AppURL:          strings.TrimRight(getenv("APP_URL", "http://localhost:3000"), "/"),
		SMTPHost:        os.Getenv("SMTP_HOST"),
		SMTPPort:        getenv("SMTP_PORT", "587"),
		SMTPUser:        os.Getenv("SMTP_USER"),
		SMTPPassword:    os.Getenv("SMTP_PASSWORD"),
		MailFrom:        os.Getenv("MAIL_FROM"),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is not set")
	}
	if v := os.Getenv("SHUTDOWN_TIMEOUT"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			return Config{}, errors.New("SHUTDOWN_TIMEOUT must be a duration like 10s")
		}
		cfg.ShutdownTimeout = d
	}
	if (cfg.AdminEmail == "") != (cfg.AdminPassword == "") {
		return Config{}, errors.New("set both ADMIN_EMAIL and ADMIN_PASSWORD, or neither")
	}
	if cfg.SMTPHost != "" && cfg.MailFrom == "" {
		return Config{}, errors.New("MAIL_FROM is not set (needed with SMTP_HOST)")
	}
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
