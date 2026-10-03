// Package background assembles the job worker and periodic maintenance shared by
// cmd/worker and the server's optional embedded worker.
package background

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	authrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	wikirepo "github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	wikisvc "github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
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
	wiki := wikisvc.NewMaintenance(wikirepo.New(pool))
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		if err := auth.DeleteExpired(ctx); err != nil && ctx.Err() == nil {
			log.Warn("refresh-token cleanup failed", slog.Any("err", err))
		}
		if n, err := wiki.PurgeExpired(ctx); err != nil && ctx.Err() == nil {
			log.Warn("wiki trash purge failed", slog.Any("err", err))
		} else if n > 0 {
			log.Info("wiki trash purged", slog.Int("roots", n))
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}
