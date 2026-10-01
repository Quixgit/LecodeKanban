// Package jobs is a PostgreSQL-backed background job queue with retries,
// exponential backoff and idempotency keys (SELECT … FOR UPDATE SKIP LOCKED).
package jobs

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

// DBTX is satisfied by *pgxpool.Pool and pgx.Tx, so jobs can be enqueued inside
// the same transaction as the business write (transactional outbox).
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

type EnqueueOptions struct {
	RunAt       time.Time
	MaxAttempts int
	// Key makes enqueueing idempotent: a second job with the same key is ignored.
	Key string
}

// Enqueue inserts a job. payload is JSON-encoded.
func Enqueue(ctx context.Context, db DBTX, kind string, payload any, opts EnqueueOptions) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("jobs: encode %s: %w", kind, err)
	}
	if opts.MaxAttempts <= 0 {
		opts.MaxAttempts = 8
	}
	runAt := opts.RunAt
	if runAt.IsZero() {
		runAt = time.Now()
	}
	var key *string
	if opts.Key != "" {
		key = &opts.Key
	}
	_, err = db.Exec(ctx, `
		INSERT INTO jobs (kind, payload, max_attempts, run_at, idempotency_key)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
		kind, body, opts.MaxAttempts, runAt, key)
	if err != nil {
		return fmt.Errorf("jobs: enqueue %s: %w", kind, err)
	}
	_, _ = db.Exec(ctx, `SELECT pg_notify('lk_jobs', $1)`, kind)
	return nil
}

// Backoff returns the delay before retry number `attempt` (1-based): 2^n seconds
// with ±20 % jitter, capped at one hour.
func Backoff(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	d := time.Duration(1<<min(attempt, 12)) * time.Second
	if d > time.Hour {
		d = time.Hour
	}
	jitter := 0.8 + rand.Float64()*0.4 //nolint:gosec // G404: scheduling jitter, not security-sensitive
	return time.Duration(float64(d) * jitter)
}

// Permanent wraps an error to stop retries (e.g. malformed payload).
type Permanent struct{ Err error }

func (p Permanent) Error() string { return "permanent: " + p.Err.Error() }
func (p Permanent) Unwrap() error { return p.Err }
