// Package config reads the API's settings from the environment.
package config

import (
	"errors"
	"os"
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
	return cfg, nil
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
