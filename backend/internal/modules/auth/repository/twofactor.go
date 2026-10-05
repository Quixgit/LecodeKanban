package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

// TwoFactor is a user's second-factor record. Secret is still sealed.
type TwoFactor struct {
	Secret    []byte
	Enabled   bool
	LastStep  int64
	Recovery  [][]byte
	EnabledAt *time.Time
}

// TwoFactor returns the record, or nil when the user never started setting it up.
func (r *Repo) TwoFactor(ctx context.Context, userID uuid.UUID) (*TwoFactor, error) {
	var t TwoFactor
	err := r.pool.QueryRow(ctx,
		`SELECT secret, enabled, last_step, recovery_hashes, enabled_at FROM user_two_factor WHERE user_id = $1`, userID).
		Scan(&t.Secret, &t.Enabled, &t.LastStep, &t.Recovery, &t.EnabledAt)
	if db.IsNoRows(err) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &t, nil
}

// StartTwoFactor stores a fresh (not yet enabled) secret; an enabled record is left alone.
func (r *Repo) StartTwoFactor(ctx context.Context, userID uuid.UUID, sealed []byte) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`INSERT INTO user_two_factor (user_id, secret) VALUES ($1, $2)
		 ON CONFLICT (user_id) DO UPDATE SET secret = EXCLUDED.secret, last_step = 0, created_at = now()
		 WHERE user_two_factor.enabled = false`, userID, sealed)
	return tag.RowsAffected() == 1, err
}

// EnableTwoFactor switches the factor on after the first code, recording that step and the recovery codes.
func (r *Repo) EnableTwoFactor(ctx context.Context, userID uuid.UUID, step int64, recovery [][]byte) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE user_two_factor SET enabled = true, enabled_at = now(), last_step = $2, recovery_hashes = $3
		 WHERE user_id = $1 AND enabled = false`, userID, step, recovery)
	return tag.RowsAffected() == 1, err
}

// AcceptStep records a used step; false when that step (or a later one) was already used.
func (r *Repo) AcceptStep(ctx context.Context, userID uuid.UUID, step int64) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE user_two_factor SET last_step = $2 WHERE user_id = $1 AND enabled AND last_step < $2`, userID, step)
	return tag.RowsAffected() == 1, err
}

// UseRecovery removes one recovery code; false when it is not there (so each works once).
func (r *Repo) UseRecovery(ctx context.Context, userID uuid.UUID, hash []byte) (bool, error) {
	tag, err := r.pool.Exec(ctx,
		`UPDATE user_two_factor SET recovery_hashes = array_remove(recovery_hashes, $2)
		 WHERE user_id = $1 AND enabled AND $2 = ANY(recovery_hashes)`, userID, hash)
	return tag.RowsAffected() == 1, err
}

// ReplaceRecovery stores a new set of recovery codes.
func (r *Repo) ReplaceRecovery(ctx context.Context, userID uuid.UUID, recovery [][]byte) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE user_two_factor SET recovery_hashes = $2 WHERE user_id = $1 AND enabled`, userID, recovery)
	return err
}

// DisableTwoFactor forgets the factor.
func (r *Repo) DisableTwoFactor(ctx context.Context, userID uuid.UUID) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM user_two_factor WHERE user_id = $1`, userID)
	return err
}
