package store

import (
	"context"

	"github.com/jackc/pgx/v5"

	"rost/backend/internal/clock"
)

func (s *Postgres) ListPartners(ctx context.Context) ([]string, error) {
	rows, err := s.db.Query(ctx, `SELECT key FROM partner_providers ORDER BY key`)
	if err != nil {
		return nil, err
	}
	return pgx.CollectRows(rows, pgx.RowTo[string])
}

func (s *Postgres) SetPartner(ctx context.Context, key string, on bool, by string) error {
	if !on {
		_, err := s.db.Exec(ctx, `DELETE FROM partner_providers WHERE key = $1`, key)
		return err
	}
	_, err := s.db.Exec(ctx,
		`INSERT INTO partner_providers (key, updated_at, updated_by) VALUES ($1, $2, $3)
		 ON CONFLICT (key) DO UPDATE SET updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by`,
		key, clock.NowISO(), by)
	return err
}
