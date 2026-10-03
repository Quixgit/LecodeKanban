// Command server runs the LecodeKanban HTTP API.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/background"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		if err := healthcheck(); err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "server:", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(os.Stdout, cfg.LogLevel, cfg.IsProduction())
	slog.SetDefault(log)
	log.Info("starting server", slog.Any("config", cfg.Redacted()))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.DatabaseMaxConn)
	if err != nil {
		return err
	}
	defer pool.Close()

	app, err := build(cfg, pool, log)
	if err != nil {
		return err
	}
	go app.Realtime.Run(ctx)
	go app.Integrations.Run(ctx, cfg.IntegrationsTick)

	api := &http.Server{
		Addr: cfg.HTTPAddr, Handler: app.Router,
		ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 60 * time.Second, IdleTimeout: 120 * time.Second,
	}
	api.RegisterOnShutdown(app.Realtime.Close) // end SSE streams so Shutdown can drain
	metricsSrv := &http.Server{Addr: cfg.MetricsAddr, Handler: app.Metrics.Handler(), ReadHeaderTimeout: 5 * time.Second}

	errc := make(chan error, 3)
	go func() { errc <- serve(api, "api", log) }()
	go func() { errc <- serve(metricsSrv, "metrics", log) }()

	workerDone := make(chan struct{})
	if cfg.EmbeddedWorker {
		go func() {
			defer close(workerDone)
			if err := background.Run(ctx, cfg, pool, log); err != nil {
				errc <- err
			}
		}()
	} else {
		close(workerDone)
	}

	var fatal error
	select {
	case <-ctx.Done():
		log.Info("shutdown signal received")
	case fatal = <-errc:
		log.Error("server error", slog.Any("err", fatal))
		stop()
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()
	_ = metricsSrv.Shutdown(shutdownCtx)
	if err := api.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("graceful shutdown: %w", err)
	}
	select {
	case <-workerDone:
	case <-shutdownCtx.Done():
		log.Warn("worker did not stop in time")
	}
	log.Info("server stopped")
	return fatal // non-nil → exit code 1, so supervisors notice e.g. a port clash
}

func serve(s *http.Server, name string, log *slog.Logger) error {
	log.Info("listening", slog.String("server", name), slog.String("addr", s.Addr))
	if err := s.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("%s: %w", name, err)
	}
	return nil
}
