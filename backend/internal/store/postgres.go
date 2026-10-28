package store

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"sort"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
)

//go:embed migrations/*.sql
var migrations embed.FS

// Postgres is the Store on a pgx pool. Schema in migrations/.
type Postgres struct{ db *pgxpool.Pool }

func NewPostgres(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

// Migrate applies migrations/*.sql in order, once each, then seeds the demo personas
// (existing rows are left alone). Safe to run on every start.
func (s *Postgres) Migrate(ctx context.Context, seed []domain.User) error {
	if _, err := s.db.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("migrations table: %w", err)
	}
	entries, err := migrations.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)
	for _, name := range names {
		sql, err := migrations.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		err = pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
			tag, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, name)
			if err != nil || tag.RowsAffected() == 0 {
				return err
			}
			_, err = tx.Exec(ctx, string(sql))
			return err
		})
		if err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	for _, u := range seed {
		if u.CreatedAt == "" {
			u.CreatedAt = clock.NowISO()
		}
		if err := s.insertUser(ctx, s.db, u, true); err != nil {
			return fmt.Errorf("seed %s: %w", u.ID, err)
		}
	}
	return nil
}

type execer interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

// jsonb encodes v for a JSONB column; nil maps and pointers become SQL NULL.
func jsonb(v any) any {
	b, _ := json.Marshal(v)
	if string(b) == "null" {
		return nil
	}
	return string(b)
}

func unjson(raw []byte, v any) error {
	if raw == nil {
		return nil
	}
	return json.Unmarshal(raw, v)
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

// ---- users ----

const userCols = `id, name, situations, payday, hire_date, gross_monthly, last_raise_date, monthly_expenses, firsts_done, spending, quiz, level_earned, created_at`

func (s *Postgres) insertUser(ctx context.Context, db execer, u domain.User, ignoreExisting bool) error {
	sql := `INSERT INTO users (` + userCols + `) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13)`
	if ignoreExisting {
		sql += ` ON CONFLICT (id) DO NOTHING`
	}
	_, err := db.Exec(ctx, sql, u.ID, u.Name, jsonb(nonNil(u.Situations)), u.Payday, u.HireDate, u.GrossMonthly, u.LastRaiseDate,
		u.MonthlyExpenses, jsonb(nonNil(u.FirstsDone)), jsonb(u.Spending), jsonb(u.Quiz), u.LevelEarned, u.CreatedAt)
	return err
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

func scanUser(row pgx.Row) (domain.User, error) {
	var u domain.User
	var situations, firsts, spending, quiz []byte
	var payday *int32
	err := row.Scan(&u.ID, &u.Name, &situations, &payday, &u.HireDate, &u.GrossMonthly, &u.LastRaiseDate, &u.MonthlyExpenses, &firsts, &spending, &quiz, &u.LevelEarned, &u.CreatedAt)
	if err != nil {
		return u, notFound(err)
	}
	if payday != nil {
		u.Payday = domain.Ptr(int(*payday))
	}
	u.Situations, u.FirstsDone = []domain.Situation{}, []domain.FirstDone{}
	if err := unjson(situations, &u.Situations); err != nil {
		return u, err
	}
	if err := unjson(firsts, &u.FirstsDone); err != nil {
		return u, err
	}
	if spending != nil {
		u.Spending = &domain.SpendingProfile{}
		if err := unjson(spending, u.Spending); err != nil {
			return u, err
		}
	}
	if quiz != nil {
		u.Quiz = &domain.QuizProfile{}
		if err := unjson(quiz, u.Quiz); err != nil {
			return u, err
		}
	}
	return u, nil
}

func (s *Postgres) CreateUser(ctx context.Context, u domain.User) (domain.User, error) {
	if u.CreatedAt == "" {
		u.CreatedAt = clock.NowISO()
	}
	u.Situations, u.FirstsDone = nonNil(u.Situations), nonNil(u.FirstsDone)
	return u, s.insertUser(ctx, s.db, u, false)
}

func (s *Postgres) GetUser(ctx context.Context, id string) (domain.User, error) {
	return scanUser(s.db.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id))
}

func (s *Postgres) UpdateUser(ctx context.Context, u domain.User) error {
	tag, err := s.db.Exec(ctx, `UPDATE users SET name = $2, situations = $3::jsonb, payday = $4, hire_date = $5, gross_monthly = $6,
		last_raise_date = $7, monthly_expenses = $8, firsts_done = $9::jsonb, spending = $10::jsonb, quiz = $11::jsonb, level_earned = $12 WHERE id = $1`,
		u.ID, u.Name, jsonb(nonNil(u.Situations)), u.Payday, u.HireDate, u.GrossMonthly, u.LastRaiseDate, u.MonthlyExpenses,
		jsonb(nonNil(u.FirstsDone)), jsonb(u.Spending), jsonb(u.Quiz), u.LevelEarned)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// ---- events ----

func (s *Postgres) AddEvent(ctx context.Context, e domain.AppEvent) (domain.AppEvent, error) {
	e.ID = NewID()
	if e.CreatedAt == "" {
		e.CreatedAt = clock.NowISO()
	}
	if e.Payload == nil {
		e.Payload = map[string]any{}
	}
	_, err := s.db.Exec(ctx, `INSERT INTO events (id, user_id, type, payload, source, created_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
		e.ID, e.UserID, e.Type, jsonb(e.Payload), e.Source, e.CreatedAt)
	return e, err
}

func (s *Postgres) ListEvents(ctx context.Context, userID string) ([]domain.AppEvent, error) {
	rows, err := s.db.Query(ctx, `SELECT id, user_id, type, payload, source, created_at FROM events WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.AppEvent, error) {
		var e domain.AppEvent
		var payload []byte
		if err := row.Scan(&e.ID, &e.UserID, &e.Type, &payload, &e.Source, &e.CreatedAt); err != nil {
			return e, err
		}
		e.Payload = map[string]any{}
		return e, unjson(payload, &e.Payload)
	})
}

// ---- moment runs ----

const runCols = `id, user_id, moment_id, trigger_event_id, state, guess, result, created_at, started_at, completed_at`

func scanRun(row pgx.Row) (domain.MomentRun, error) {
	var r domain.MomentRun
	var result []byte
	if err := row.Scan(&r.ID, &r.UserID, &r.MomentID, &r.TriggerEventID, &r.State, &r.Guess, &result, &r.CreatedAt, &r.StartedAt, &r.CompletedAt); err != nil {
		return r, notFound(err)
	}
	return r, unjson(result, &r.Result)
}

func (s *Postgres) CreateRun(ctx context.Context, r domain.MomentRun) (domain.MomentRun, error) {
	r.ID = NewID()
	if r.CreatedAt == "" {
		r.CreatedAt = clock.NowISO()
	}
	_, err := s.db.Exec(ctx, `INSERT INTO moment_runs (`+runCols+`) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
		r.ID, r.UserID, r.MomentID, r.TriggerEventID, r.State, r.Guess, jsonb(r.Result), r.CreatedAt, r.StartedAt, r.CompletedAt)
	return r, err
}

func (s *Postgres) GetRun(ctx context.Context, id string) (domain.MomentRun, error) {
	return scanRun(s.db.QueryRow(ctx, `SELECT `+runCols+` FROM moment_runs WHERE id = $1`, id))
}

func (s *Postgres) UpdateRun(ctx context.Context, r domain.MomentRun) error {
	tag, err := s.db.Exec(ctx, `UPDATE moment_runs SET moment_id = $2, trigger_event_id = $3, state = $4, guess = $5, result = $6::jsonb,
		started_at = $7, completed_at = $8 WHERE id = $1`,
		r.ID, r.MomentID, r.TriggerEventID, r.State, r.Guess, jsonb(r.Result), r.StartedAt, r.CompletedAt)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Postgres) ListRuns(ctx context.Context, userID string) ([]domain.MomentRun, error) {
	rows, err := s.db.Query(ctx, `SELECT `+runCols+` FROM moment_runs WHERE $1 = '' OR user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.MomentRun, error) { return scanRun(row) })
}

// ---- actions ----

const actionCols = `id, user_id, moment_run_id, type, params, status, follow_up_at, created_at`

func (s *Postgres) CreateAction(ctx context.Context, a domain.Action) (domain.Action, error) {
	a.ID = NewID()
	if a.CreatedAt == "" {
		a.CreatedAt = clock.NowISO()
	}
	if a.Params == nil {
		a.Params = map[string]any{}
	}
	_, err := s.db.Exec(ctx, `INSERT INTO actions (`+actionCols+`) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
		a.ID, a.UserID, a.MomentRunID, a.Type, jsonb(a.Params), a.Status, a.FollowUpAt, a.CreatedAt)
	return a, err
}

func (s *Postgres) UpdateAction(ctx context.Context, a domain.Action) error {
	tag, err := s.db.Exec(ctx, `UPDATE actions SET status = $2, params = $3::jsonb WHERE id = $1`, a.ID, a.Status, jsonb(nonNilMap(a.Params)))
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func nonNilMap(m map[string]any) map[string]any {
	if m == nil {
		return map[string]any{}
	}
	return m
}

func (s *Postgres) ListActions(ctx context.Context, userID string) ([]domain.Action, error) {
	rows, err := s.db.Query(ctx, `SELECT `+actionCols+` FROM actions WHERE $1 = '' OR user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Action, error) {
		var a domain.Action
		var params []byte
		if err := row.Scan(&a.ID, &a.UserID, &a.MomentRunID, &a.Type, &params, &a.Status, &a.FollowUpAt, &a.CreatedAt); err != nil {
			return a, err
		}
		a.Params = map[string]any{}
		return a, unjson(params, &a.Params)
	})
}

// ---- referrals ----

const referralCols = `id, click_id, user_id, offer_id, partner_id, status, fee_lei, created_at, updated_at`

func scanReferral(row pgx.Row) (domain.Referral, error) {
	var r domain.Referral
	err := row.Scan(&r.ID, &r.ClickID, &r.UserID, &r.OfferID, &r.PartnerID, &r.Status, &r.FeeLei, &r.CreatedAt, &r.UpdatedAt)
	return r, notFound(err)
}

func (s *Postgres) CreateReferral(ctx context.Context, r domain.Referral) (domain.Referral, error) {
	r.ID = NewID()
	r.CreatedAt = clock.NowISO()
	r.UpdatedAt = r.CreatedAt
	_, err := s.db.Exec(ctx, `INSERT INTO referrals (`+referralCols+`) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		r.ID, r.ClickID, r.UserID, r.OfferID, r.PartnerID, r.Status, r.FeeLei, r.CreatedAt, r.UpdatedAt)
	return r, err
}

func (s *Postgres) GetReferralByClick(ctx context.Context, clickID string) (domain.Referral, error) {
	return scanReferral(s.db.QueryRow(ctx, `SELECT `+referralCols+` FROM referrals WHERE click_id = $1`, clickID))
}

func (s *Postgres) UpdateReferral(ctx context.Context, r domain.Referral) error {
	tag, err := s.db.Exec(ctx, `UPDATE referrals SET status = $2, fee_lei = $3, updated_at = $4 WHERE click_id = $1`,
		r.ClickID, r.Status, r.FeeLei, r.UpdatedAt)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Postgres) ListReferrals(ctx context.Context) ([]domain.Referral, error) {
	rows, err := s.db.Query(ctx, `SELECT `+referralCols+` FROM referrals ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Referral, error) { return scanReferral(row) })
}

// ---- demo reset ----

func (s *Postgres) ResetUsers(ctx context.Context, seed []domain.User) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		for _, u := range seed {
			for _, sql := range []string{
				`DELETE FROM actions WHERE user_id = $1`,
				`DELETE FROM moment_runs WHERE user_id = $1`,
				`DELETE FROM events WHERE user_id = $1`,
				`DELETE FROM referrals WHERE user_id = $1`,
				`DELETE FROM library_completions WHERE user_id = $1`,
				`DELETE FROM track_events WHERE user_id = $1`,
				`DELETE FROM users WHERE id = $1`,
			} {
				if _, err := tx.Exec(ctx, sql, u.ID); err != nil {
					return err
				}
			}
			u.CreatedAt = clock.NowISO()
			if err := s.insertUser(ctx, tx, u, false); err != nil {
				return err
			}
		}
		return nil
	})
}
