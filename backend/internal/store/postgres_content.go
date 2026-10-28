package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"rost/backend/internal/clock"
	"rost/backend/internal/domain"
)

// 23505 = unique violation
func conflict(err error) error {
	var pg *pgconn.PgError
	if errors.As(err, &pg) && pg.Code == "23505" {
		return ErrConflict
	}
	return err
}

func (s *Postgres) ListUsers(ctx context.Context) ([]domain.User, error) {
	rows, err := s.db.Query(ctx, `SELECT `+userCols+` FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.User, error) { return scanUser(row) })
}

// ---- content ----

const contentCols = `kind, id, status, position, doc, created_at, updated_at, updated_by`

func scanContent(row pgx.Row) (domain.ContentItem, error) {
	var c domain.ContentItem
	var doc []byte
	if err := row.Scan(&c.Kind, &c.ID, &c.Status, &c.Position, &doc, &c.CreatedAt, &c.UpdatedAt, &c.UpdatedBy); err != nil {
		return c, notFound(err)
	}
	c.Doc = doc
	return c, nil
}

func (s *Postgres) ListContent(ctx context.Context, kind domain.ContentKind, withDrafts bool) ([]domain.ContentItem, error) {
	rows, err := s.db.Query(ctx, `SELECT `+contentCols+` FROM content_items WHERE kind = $1 AND ($2 OR status = 'published') ORDER BY position, id`,
		kind, withDrafts)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.ContentItem, error) { return scanContent(row) })
}

func (s *Postgres) GetContent(ctx context.Context, kind domain.ContentKind, id string) (domain.ContentItem, error) {
	return scanContent(s.db.QueryRow(ctx, `SELECT `+contentCols+` FROM content_items WHERE kind = $1 AND id = $2`, kind, id))
}

func (s *Postgres) insertContent(ctx context.Context, db execer, c domain.ContentItem, ignoreExisting bool) (domain.ContentItem, error) {
	now := clock.NowISO()
	c.CreatedAt, c.UpdatedAt = now, now
	sql := `INSERT INTO content_items (` + contentCols + `) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`
	if ignoreExisting {
		sql += ` ON CONFLICT DO NOTHING`
	}
	_, err := db.Exec(ctx, sql, c.Kind, c.ID, c.Status, c.Position, string(c.Doc), c.CreatedAt, c.UpdatedAt, c.UpdatedBy)
	return c, conflict(err)
}

func (s *Postgres) CreateContent(ctx context.Context, c domain.ContentItem) (domain.ContentItem, error) {
	return s.insertContent(ctx, s.db, c, false)
}

func (s *Postgres) UpdateContent(ctx context.Context, c domain.ContentItem) (domain.ContentItem, error) {
	c.UpdatedAt = clock.NowISO()
	err := s.db.QueryRow(ctx, `UPDATE content_items SET status = $3, position = $4, doc = $5::jsonb, updated_at = $6, updated_by = $7
		WHERE kind = $1 AND id = $2 RETURNING created_at`,
		c.Kind, c.ID, c.Status, c.Position, string(c.Doc), c.UpdatedAt, c.UpdatedBy).Scan(&c.CreatedAt)
	return c, notFound(err)
}

func (s *Postgres) DeleteContent(ctx context.Context, kind domain.ContentKind, id string) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM content_items WHERE kind = $1 AND id = $2`, kind, id)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// marked in schema_migrations so it only runs once
func (s *Postgres) SeedContent(ctx context.Context, seedName string, items []domain.ContentItem) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		tag, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING`, "seed:"+seedName)
		if err != nil || tag.RowsAffected() == 0 {
			return err
		}
		for _, c := range items {
			if _, err := s.insertContent(ctx, tx, c, true); err != nil {
				return err
			}
		}
		return nil
	})
}

// ---- library progress ----

func (s *Postgres) AddCompletion(ctx context.Context, c domain.Completion) (bool, error) {
	if c.CompletedAt == "" {
		c.CompletedAt = clock.NowISO()
	}
	tag, err := s.db.Exec(ctx, `INSERT INTO library_completions (user_id, moment_id, answers, correct, total, completed_at)
		VALUES ($1, $2, $3::jsonb, $4, $5, $6) ON CONFLICT DO NOTHING`,
		c.UserID, c.MomentID, jsonb(nonNil(c.Answers)), c.Correct, c.Total, c.CompletedAt)
	return err == nil && tag.RowsAffected() == 1, err
}

func (s *Postgres) ListCompletions(ctx context.Context, userID string) ([]domain.Completion, error) {
	rows, err := s.db.Query(ctx, `SELECT user_id, moment_id, answers, correct, total, completed_at FROM library_completions
		WHERE $1 = '' OR user_id = $1 ORDER BY completed_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Completion, error) {
		var c domain.Completion
		var answers []byte
		if err := row.Scan(&c.UserID, &c.MomentID, &answers, &c.Correct, &c.Total, &c.CompletedAt); err != nil {
			return c, err
		}
		c.Answers = []map[string]any{}
		return c, unjson(answers, &c.Answers)
	})
}

// ---- tracking ----

func (s *Postgres) AddTrackEvents(ctx context.Context, events []domain.TrackEvent) error {
	batch := &pgx.Batch{}
	for _, e := range events {
		if e.ID == "" {
			e.ID = NewID()
		}
		if e.CreatedAt == "" {
			e.CreatedAt = clock.NowISO()
		}
		batch.Queue(`INSERT INTO track_events (id, user_id, name, props, path, created_at) VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
			e.ID, e.UserID, e.Name, jsonb(nonNilMap(e.Props)), e.Path, e.CreatedAt)
	}
	return s.db.SendBatch(ctx, batch).Close()
}

func (s *Postgres) ListTrackEvents(ctx context.Context, fromISO, toISO string) ([]domain.TrackEvent, error) {
	rows, err := s.db.Query(ctx, `SELECT id, user_id, name, props, path, created_at FROM track_events
		WHERE created_at >= $1 AND created_at < $2 ORDER BY created_at`, fromISO, toISO)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.TrackEvent, error) {
		var e domain.TrackEvent
		var props []byte
		if err := row.Scan(&e.ID, &e.UserID, &e.Name, &props, &e.Path, &e.CreatedAt); err != nil {
			return e, err
		}
		e.Props = map[string]any{}
		return e, unjson(props, &e.Props)
	})
}

// ---- admins ----

const adminCols = `id, email, password_hash, created_at`

func scanAdmin(row pgx.Row) (domain.Admin, error) {
	var a domain.Admin
	return a, notFound(row.Scan(&a.ID, &a.Email, &a.PasswordHash, &a.CreatedAt))
}

func (s *Postgres) CreateAdmin(ctx context.Context, a domain.Admin) (domain.Admin, error) {
	a.ID, a.CreatedAt = NewID(), clock.NowISO()
	_, err := s.db.Exec(ctx, `INSERT INTO admins (`+adminCols+`) VALUES ($1, $2, $3, $4)`, a.ID, a.Email, a.PasswordHash, a.CreatedAt)
	return a, conflict(err)
}

func (s *Postgres) GetAdmin(ctx context.Context, id string) (domain.Admin, error) {
	return scanAdmin(s.db.QueryRow(ctx, `SELECT `+adminCols+` FROM admins WHERE id = $1`, id))
}

func (s *Postgres) GetAdminByEmail(ctx context.Context, email string) (domain.Admin, error) {
	return scanAdmin(s.db.QueryRow(ctx, `SELECT `+adminCols+` FROM admins WHERE email = $1`, email))
}

func (s *Postgres) ListAdmins(ctx context.Context) ([]domain.Admin, error) {
	rows, err := s.db.Query(ctx, `SELECT `+adminCols+` FROM admins ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Admin, error) { return scanAdmin(row) })
}

func (s *Postgres) CreateAdminSession(ctx context.Context, a domain.AdminSession) error {
	_, err := s.db.Exec(ctx, `INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, $3)`, a.TokenHash, a.AdminID, a.ExpiresAt)
	return err
}

func (s *Postgres) GetAdminSession(ctx context.Context, tokenHash string) (domain.AdminSession, error) {
	var a domain.AdminSession
	err := s.db.QueryRow(ctx, `SELECT token_hash, admin_id, expires_at FROM admin_sessions WHERE token_hash = $1`, tokenHash).
		Scan(&a.TokenHash, &a.AdminID, &a.ExpiresAt)
	return a, notFound(err)
}

func (s *Postgres) DeleteAdminSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM admin_sessions WHERE token_hash = $1`, tokenHash)
	return err
}
