package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Handler processes one job payload. Return Permanent{} to skip remaining retries.
type Handler func(ctx context.Context, payload json.RawMessage) error

type Worker struct {
	pool        *pgxpool.Pool
	log         *slog.Logger
	handlers    map[string]Handler
	concurrency int
	pollEvery   time.Duration
	lease       time.Duration
	id          string
}

func NewWorker(pool *pgxpool.Pool, log *slog.Logger, concurrency int) *Worker {
	host, _ := os.Hostname()
	return &Worker{
		pool: pool, log: log.With(slog.String("component", "jobs")), handlers: map[string]Handler{},
		concurrency: max(1, concurrency), pollEvery: 2 * time.Second, lease: 5 * time.Minute,
		id: fmt.Sprintf("%s-%d", host, os.Getpid()),
	}
}

// Handle registers the handler for a job kind. Call before Run.
func (w *Worker) Handle(kind string, h Handler) { w.handlers[kind] = h }

type claimed struct {
	id       int64
	kind     string
	payload  json.RawMessage
	attempts int
	max      int
}

// Run processes jobs until ctx is cancelled, then waits for in-flight jobs.
func (w *Worker) Run(ctx context.Context) error {
	wake := make(chan struct{}, 1)
	go w.listen(ctx, wake)
	go w.janitor(ctx)

	sem := make(chan struct{}, w.concurrency)
	var wg sync.WaitGroup
	ticker := time.NewTicker(w.pollEvery)
	defer ticker.Stop()
	w.log.Info("worker started", slog.Int("concurrency", w.concurrency))

	for {
		for {
			free := w.concurrency - len(sem)
			if free == 0 {
				break
			}
			batch, err := w.claim(ctx, free)
			if err != nil {
				if ctx.Err() == nil {
					w.log.Error("claim failed", slog.Any("err", err))
				}
				break
			}
			if len(batch) == 0 {
				break
			}
			for _, j := range batch {
				sem <- struct{}{}
				wg.Add(1)
				go func(j claimed) {
					defer func() { <-sem; wg.Done() }()
					w.process(context.WithoutCancel(ctx), j)
				}(j)
			}
		}
		select {
		case <-ctx.Done():
			wg.Wait()
			w.log.Info("worker stopped")
			return nil
		case <-ticker.C:
		case <-wake:
		}
	}
}

func (w *Worker) claim(ctx context.Context, limit int) ([]claimed, error) {
	rows, err := w.pool.Query(ctx, `
		UPDATE jobs SET status = 'running', attempts = attempts + 1,
		       locked_until = now() + $2::interval, locked_by = $3, updated_at = now()
		WHERE id IN (
			SELECT id FROM jobs
			WHERE (status = 'pending' AND run_at <= now())
			   OR (status = 'running' AND locked_until < now())
			ORDER BY run_at
			LIMIT $1
			FOR UPDATE SKIP LOCKED)
		RETURNING id, kind, payload, attempts, max_attempts`,
		limit, w.lease.String(), w.id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []claimed
	for rows.Next() {
		var j claimed
		if err := rows.Scan(&j.id, &j.kind, &j.payload, &j.attempts, &j.max); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

func (w *Worker) process(ctx context.Context, j claimed) {
	log := w.log.With(slog.Int64("job_id", j.id), slog.String("kind", j.kind), slog.Int("attempt", j.attempts))
	h, ok := w.handlers[j.kind]
	var err error
	if !ok {
		err = Permanent{fmt.Errorf("no handler for kind %q", j.kind)}
	} else {
		runCtx, cancel := context.WithTimeout(ctx, w.lease-10*time.Second)
		err = safeRun(runCtx, h, j.payload)
		cancel()
	}

	if err == nil {
		_, dbErr := w.pool.Exec(ctx, `UPDATE jobs SET status='done', completed_at=now(), locked_until=NULL, last_error=NULL, updated_at=now() WHERE id=$1`, j.id)
		if dbErr != nil {
			log.Error("mark done failed", slog.Any("err", dbErr))
		}
		log.Debug("job done")
		return
	}

	var perm Permanent
	if errors.As(err, &perm) || j.attempts >= j.max {
		_, _ = w.pool.Exec(ctx, `UPDATE jobs SET status='failed', last_error=$2, locked_until=NULL, updated_at=now() WHERE id=$1`, j.id, err.Error())
		log.Error("job failed permanently", slog.Any("err", err))
		return
	}
	next := time.Now().Add(Backoff(j.attempts))
	_, _ = w.pool.Exec(ctx, `UPDATE jobs SET status='pending', run_at=$2, last_error=$3, locked_until=NULL, updated_at=now() WHERE id=$1`, j.id, next, err.Error())
	log.Warn("job failed, will retry", slog.Any("err", err), slog.Time("retry_at", next))
}

func safeRun(ctx context.Context, h Handler, p json.RawMessage) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("handler panic: %v", r)
		}
	}()
	return h(ctx, p)
}

// listen wakes the loop on pg_notify('lk_jobs') so new jobs start immediately.
func (w *Worker) listen(ctx context.Context, wake chan<- struct{}) {
	for ctx.Err() == nil {
		conn, err := w.pool.Acquire(ctx)
		if err != nil {
			time.Sleep(time.Second)
			continue
		}
		if _, err = conn.Exec(ctx, "LISTEN lk_jobs"); err == nil {
			for {
				if _, err = conn.Conn().WaitForNotification(ctx); err != nil {
					break
				}
				select {
				case wake <- struct{}{}:
				default:
				}
			}
		}
		conn.Release()
	}
}

// janitor deletes finished jobs after a week.
func (w *Worker) janitor(ctx context.Context) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			_, _ = w.pool.Exec(ctx, `DELETE FROM jobs WHERE status='done' AND completed_at < now() - interval '7 days'`)
		}
	}
}
