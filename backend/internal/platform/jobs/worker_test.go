package jobs_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

type jobRow struct {
	Status   string
	Attempts int
	LastErr  *string
}

func row(t *testing.T, kind string) jobRow {
	t.Helper()
	var r jobRow
	err := tdb.Pool.QueryRow(context.Background(), `SELECT status, attempts, last_error FROM jobs WHERE kind=$1`, kind).
		Scan(&r.Status, &r.Attempts, &r.LastErr)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatal("condition not met in time")
		}
		time.Sleep(50 * time.Millisecond)
	}
}

func TestWorkerProcessesRetriesAndFails(t *testing.T) {
	tdb.Reset(t)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	db := tdb.Pool

	var okCalls, flaky atomic.Int32
	w := jobs.NewWorker(db, slog.New(slog.NewTextHandler(io.Discard, nil)), 2)
	w.Handle("ok", func(_ context.Context, p json.RawMessage) error {
		var v struct{ N int }
		if err := json.Unmarshal(p, &v); err != nil || v.N != 7 {
			return jobs.Permanent{Err: errors.New("bad payload")}
		}
		okCalls.Add(1)
		return nil
	})
	w.Handle("flaky", func(context.Context, json.RawMessage) error {
		flaky.Add(1)
		return errors.New("smtp down")
	})
	w.Handle("perm", func(context.Context, json.RawMessage) error {
		return jobs.Permanent{Err: errors.New("invalid address")}
	})

	must := func(err error) {
		if err != nil {
			t.Fatal(err)
		}
	}
	must(jobs.Enqueue(ctx, db, "ok", map[string]int{"N": 7}, jobs.EnqueueOptions{Key: "once"}))
	must(jobs.Enqueue(ctx, db, "ok", map[string]int{"N": 7}, jobs.EnqueueOptions{Key: "once"})) // idempotent duplicate
	must(jobs.Enqueue(ctx, db, "flaky", nil, jobs.EnqueueOptions{MaxAttempts: 3}))
	must(jobs.Enqueue(ctx, db, "perm", nil, jobs.EnqueueOptions{}))
	must(jobs.Enqueue(ctx, db, "unknown-kind", nil, jobs.EnqueueOptions{}))

	go func() { _ = w.Run(ctx) }()

	waitFor(t, func() bool { return row(t, "ok").Status == "done" })
	waitFor(t, func() bool { return row(t, "perm").Status == "failed" })
	waitFor(t, func() bool { return row(t, "unknown-kind").Status == "failed" })
	waitFor(t, func() bool { return row(t, "flaky").Attempts >= 1 && row(t, "flaky").Status == "pending" })

	if okCalls.Load() != 1 {
		t.Fatalf("idempotency key must dedupe: handler ran %d times", okCalls.Load())
	}
	if r := row(t, "perm"); r.Attempts != 1 || r.LastErr == nil {
		t.Fatalf("permanent errors must not retry: %+v", r)
	}
	f := row(t, "flaky")
	if f.LastErr == nil || *f.LastErr != "smtp down" {
		t.Fatalf("retry must record the error: %+v", f)
	}

	// Fast-forward the backoff twice: the third attempt exhausts max_attempts.
	for i := 0; i < 2; i++ {
		_, err := db.Exec(ctx, `UPDATE jobs SET run_at = now() WHERE kind='flaky' AND status='pending'`)
		must(err)
		_, _ = db.Exec(ctx, `SELECT pg_notify('lk_jobs','flaky')`)
		want := f.Attempts + i + 1
		waitFor(t, func() bool { return row(t, "flaky").Attempts >= want && row(t, "flaky").Status != "running" })
	}
	if r := row(t, "flaky"); r.Status != "failed" || r.Attempts != 3 || flaky.Load() != 3 {
		t.Fatalf("expected failure after 3 attempts, got %+v (calls %d)", r, flaky.Load())
	}
}
