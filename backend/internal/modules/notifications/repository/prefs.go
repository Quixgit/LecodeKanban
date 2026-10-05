package repository

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
)

// Prefs returns the kinds a person switched off; everything else is on.
func (r *Repo) Disabled(ctx context.Context, user uuid.UUID) (map[domain.Kind]bool, error) {
	rows, err := r.pool.Query(ctx, `SELECT kind FROM notification_prefs WHERE user_id = $1 AND NOT enabled`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[domain.Kind]bool{}
	for rows.Next() {
		var k string
		if err := rows.Scan(&k); err != nil {
			return nil, err
		}
		out[domain.Kind(k)] = true
	}
	return out, rows.Err()
}

// IsDisabled is the cheap check made for every notification.
func (r *Repo) IsDisabled(ctx context.Context, user uuid.UUID, kind domain.Kind) (bool, error) {
	var off bool
	err := r.pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM notification_prefs WHERE user_id = $1 AND kind = $2 AND NOT enabled)`, user, string(kind)).Scan(&off)
	return off, err
}

// SetPref stores one choice; switching a kind back on removes the row, so "on" stays the default.
func (r *Repo) SetPref(ctx context.Context, user uuid.UUID, kind domain.Kind, enabled bool) error {
	if enabled {
		_, err := r.pool.Exec(ctx, `DELETE FROM notification_prefs WHERE user_id = $1 AND kind = $2`, user, string(kind))
		return err
	}
	_, err := r.pool.Exec(ctx,
		`INSERT INTO notification_prefs (user_id, kind, enabled) VALUES ($1, $2, false)
		 ON CONFLICT (user_id, kind) DO UPDATE SET enabled = false`, user, string(kind))
	return err
}
