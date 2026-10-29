// Command api runs the Rost HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"rost/backend/internal/app"
	"rost/backend/internal/config"
	"rost/backend/internal/content"
	"rost/backend/internal/database"
	"rost/backend/internal/reference"
	"rost/backend/internal/server"
	"rost/backend/internal/store"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	if err := run(logger); err != nil {
		logger.Error("api stopped", "err", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	logger.Info("connected to postgres")

	st := store.NewPostgres(db)
	if err := st.Migrate(ctx, reference.DemoUsers()); err != nil {
		return err
	}
	logger.Info("migrations applied", "demoTools", cfg.AllowDemoTools)

	seed, err := content.Seed()
	if err != nil {
		return err
	}
	if err := st.SeedContent(ctx, content.SeedName, seed); err != nil {
		return err
	}
	upgraded, err := app.Service{Store: st}.UpgradeSeededLessons(ctx, seed)
	if err != nil {
		return fmt.Errorf("upgrade lessons: %w", err)
	}
	logger.Info("lessons", "upgraded", upgraded)
	if cfg.AdminEmail != "" {
		created, err := app.Service{Store: st}.EnsureAdmin(ctx, cfg.AdminEmail, cfg.AdminPassword)
		if err != nil {
			return fmt.Errorf("admin account: %w", err)
		}
		logger.Info("admin account", "email", app.NormalizeEmail(cfg.AdminEmail), "created", created)
	}

	srv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           server.New(server.Deps{Logger: logger, DB: db, Store: st, Config: cfg}),
		ReadHeaderTimeout: 5 * time.Second,
		// A 10 MB payslip photo on a slow phone connection.
		ReadTimeout: 30 * time.Second,
		// Counted from the end of the headers: the upload plus the 60 s payslip model call.
		WriteTimeout: 100 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	errc := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", cfg.HTTPAddr)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			errc <- err
		}
		close(errc)
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}

	logger.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
