// Package background assembles the job worker and periodic maintenance shared by
// cmd/worker and the server's optional embedded worker.
package background

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	authrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

// Run processes jobs and periodic maintenance until ctx is cancelled.
func Run(ctx context.Context, cfg *config.Config, pool *pgxpool.Pool, log *slog.Logger) error {
	w := jobs.NewWorker(pool, log, 4)
	w.Handle(mailer.JobKind, mailer.JobHandler(mailer.NewSMTPSender(cfg.SMTP)))

	go maintenance(ctx, pool, log)
	return w.Run(ctx)
}

func maintenance(ctx context.Context, pool *pgxpool.Pool, log *slog.Logger) {
	auth := authrepo.New(pool)
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := auth.DeleteExpired(ctx); err != nil && ctx.Err() == nil {
			log.Warn("refresh-token cleanup failed", slog.Any("err", err))
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
