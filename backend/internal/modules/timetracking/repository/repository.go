// Package repository persists time entries.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error { return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)}) })
}

func toDomain(e store.TimeEntry) domain.Entry {
	return domain.Entry{ID: e.ID, WorkspaceID: e.WorkspaceID, CardID: e.CardID, UserID: e.UserID,
		StartedAt: e.StartedAt, EndedAt: e.EndedAt, Seconds: int(e.Seconds), Note: e.Note, Manual: e.Manual,
		CreatedAt: e.CreatedAt}
}

func notFound(err error) error {
	if db.IsNoRows(err) {
		return apperr.Wrap(domain.ErrNotFound, "time entry not found", err)
	}
	return err
}

func (r *Repo) List(ctx context.Context, card uuid.UUID) ([]domain.Entry, error) {
	rows, err := r.q.ListTimeEntries(ctx, card)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Entry, len(rows))
	for i, e := range rows {
		out[i] = toDomain(e)
	}
	return out, nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Entry, error) {
	e, err := r.q.GetTimeEntry(ctx, id)
	if err != nil {
		return domain.Entry{}, notFound(err)
	}
	return toDomain(e), nil
}

// Running returns the user's running timer, or ok=false.
func (r *Repo) Running(ctx context.Context, user uuid.UUID) (domain.Entry, bool, error) {
	e, err := r.q.RunningTimer(ctx, user)
	if db.IsNoRows(err) {
		return domain.Entry{}, false, nil
	}
	if err != nil {
		return domain.Entry{}, false, err
	}
	return toDomain(e), true, nil
}

// StopRunning ends whatever timer the user has running (no-op when none).
func (r *Repo) StopRunning(ctx context.Context, user uuid.UUID, at time.Time) error {
	return r.q.StopRunningTimer(ctx, store.StopRunningTimerParams{UserID: user, EndedAt: &at})
}

func (r *Repo) Start(ctx context.Context, ws, card, user uuid.UUID, at time.Time) (domain.Entry, error) {
	e, err := r.q.StartTimer(ctx, store.StartTimerParams{WorkspaceID: ws, CardID: card, UserID: user, StartedAt: at})
	if err != nil {
		return domain.Entry{}, err
	}
	return toDomain(e), nil
}

// Stop ends a running entry; a missing or already-stopped entry is domain.ErrNotActive.
func (r *Repo) Stop(ctx context.Context, id uuid.UUID, at time.Time) (domain.Entry, error) {
	e, err := r.q.StopTimer(ctx, store.StopTimerParams{ID: id, EndedAt: &at})
	if db.IsNoRows(err) {
		return domain.Entry{}, apperr.Wrap(domain.ErrNotActive, "timer is not running", err)
	}
	if err != nil {
		return domain.Entry{}, err
	}
	return toDomain(e), nil
}

type Log struct {
	WorkspaceID, CardID, UserID uuid.UUID
	StartedAt                   time.Time
	Seconds                     int
	Note                        string
}

func (r *Repo) Log(ctx context.Context, l Log) (domain.Entry, error) {
	end := l.StartedAt.Add(time.Duration(l.Seconds) * time.Second)
	e, err := r.q.LogTime(ctx, store.LogTimeParams{WorkspaceID: l.WorkspaceID, CardID: l.CardID, UserID: l.UserID,
		StartedAt: l.StartedAt, EndedAt: &end, Seconds: int32(l.Seconds), Note: l.Note}) //nolint:gosec // G115: bounded by MaxManualSeconds
	if err != nil {
		return domain.Entry{}, err
	}
	return toDomain(e), nil
}

func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error { return r.q.DeleteTimeEntry(ctx, id) }
