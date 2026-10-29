package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"rost/backend/internal/domain"
)

// ---- accounts ----

func (s *Postgres) GetUserByEmail(ctx context.Context, email string) (domain.User, error) {
	return scanUser(s.db.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE email = $1`, email))
}

func (s *Postgres) SetUserEmail(ctx context.Context, id, email string) error {
	tag, err := s.db.Exec(ctx, `UPDATE users SET email = $2 WHERE id = $1 AND email IS NULL`, id, email)
	if err != nil || tag.RowsAffected() == 1 {
		return conflict(err)
	}
	// unknown, or it has an email
	if _, err := s.GetUser(ctx, id); err != nil {
		return err
	}
	return ErrConflict
}

func (s *Postgres) DeleteUser(ctx context.Context, id string) error {
	return pgx.BeginFunc(ctx, s.db, func(tx pgx.Tx) error {
		for _, sql := range []string{
			// what partners pay for stays, without the person
			`UPDATE referrals SET user_id = NULL WHERE user_id = $1`,
			`UPDATE track_events SET user_id = NULL WHERE user_id = $1`,
			`DELETE FROM actions WHERE user_id = $1`,
			`DELETE FROM moment_runs WHERE user_id = $1`,
			`DELETE FROM events WHERE user_id = $1`,
			`DELETE FROM library_completions WHERE user_id = $1`,
			`DELETE FROM login_tokens WHERE user_id = $1 OR email = (SELECT email FROM users WHERE id = $1)`,
			`DELETE FROM sessions WHERE user_id = $1`,
		} {
			if _, err := tx.Exec(ctx, sql, id); err != nil {
				return err
			}
		}
		tag, err := tx.Exec(ctx, `DELETE FROM users WHERE id = $1`, id)
		if err == nil && tag.RowsAffected() == 0 {
			return ErrNotFound
		}
		return err
	})
}

func (s *Postgres) ListUserTrackEvents(ctx context.Context, userID string) ([]domain.TrackEvent, error) {
	rows, err := s.db.Query(ctx, `SELECT id, user_id, name, props, path, created_at FROM track_events
		WHERE user_id = $1 ORDER BY created_at`, userID)
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

// ---- sessions ----

const sessionCols = `token_hash, user_id, created_at, last_seen_at, expires_at`

func scanSession(row pgx.Row) (domain.Session, error) {
	var x domain.Session
	return x, notFound(row.Scan(&x.TokenHash, &x.UserID, &x.CreatedAt, &x.LastSeenAt, &x.ExpiresAt))
}

func (s *Postgres) CreateSession(ctx context.Context, x domain.Session) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE expires_at < $1`, x.CreatedAt); err != nil {
		return err
	}
	_, err := s.db.Exec(ctx, `INSERT INTO sessions (`+sessionCols+`) VALUES ($1, $2, $3, $4, $5)`,
		x.TokenHash, x.UserID, x.CreatedAt, x.LastSeenAt, x.ExpiresAt)
	return missingUser(conflict(err))
}

func (s *Postgres) GetSession(ctx context.Context, tokenHash string) (domain.Session, error) {
	return scanSession(s.db.QueryRow(ctx, `SELECT `+sessionCols+` FROM sessions WHERE token_hash = $1`, tokenHash))
}

func (s *Postgres) TouchSession(ctx context.Context, tokenHash, lastSeenAt, expiresAt string) error {
	tag, err := s.db.Exec(ctx, `UPDATE sessions SET last_seen_at = $2, expires_at = $3 WHERE token_hash = $1`, tokenHash, lastSeenAt, expiresAt)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

func (s *Postgres) DeleteSession(ctx context.Context, tokenHash string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM sessions WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Postgres) ListSessions(ctx context.Context, userID string) ([]domain.Session, error) {
	rows, err := s.db.Query(ctx, `SELECT `+sessionCols+` FROM sessions WHERE user_id = $1 ORDER BY created_at`, userID)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Session, error) { return scanSession(row) })
}

func (s *Postgres) UseLegacyUID(ctx context.Context, userID, at, since string) error {
	tag, err := s.db.Exec(ctx, `UPDATE users SET legacy_swapped_at = COALESCE(legacy_swapped_at, $2)
		WHERE id = $1 AND legacy_uid AND (legacy_swapped_at IS NULL OR legacy_swapped_at > $3)`, userID, at, since)
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// ---- email login links ----

func (s *Postgres) CreateLoginToken(ctx context.Context, t domain.LoginToken) error {
	if _, err := s.db.Exec(ctx, `DELETE FROM login_tokens WHERE expires_at < $1`, t.CreatedAt); err != nil {
		return err
	}
	var userID *string
	if t.UserID != "" {
		userID = &t.UserID
	}
	_, err := s.db.Exec(ctx, `INSERT INTO login_tokens (token_hash, email, user_id, nonce_hash, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		t.TokenHash, t.Email, userID, t.NonceHash, t.CreatedAt, t.ExpiresAt)
	return missingUser(conflict(err))
}

// missingUser maps a foreign key to a user that isn't there to ErrNotFound.
func missingUser(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" {
		return ErrNotFound
	}
	return err
}

func (s *Postgres) TakeLoginToken(ctx context.Context, tokenHash, nonceHash string) (domain.LoginToken, error) {
	var t domain.LoginToken
	var userID *string
	err := s.db.QueryRow(ctx, `DELETE FROM login_tokens WHERE token_hash = $1 AND nonce_hash = $2 AND nonce_hash <> ''
		RETURNING token_hash, email, user_id, nonce_hash, created_at, expires_at`, tokenHash, nonceHash).
		Scan(&t.TokenHash, &t.Email, &userID, &t.NonceHash, &t.CreatedAt, &t.ExpiresAt)
	if userID != nil {
		t.UserID = *userID
	}
	return t, notFound(err)
}
