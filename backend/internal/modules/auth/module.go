// Package auth owns authentication: credentials, sessions, verification, recovery and OAuth sign-in.
package auth

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/oauth"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/auth/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/ratelimit"
)

type Deps struct {
	Config  *config.Config
	Pool    *pgxpool.Pool
	Bus     *eventbus.Bus
	Tokens  *authtoken.Manager
	Users   service.Users
	Present transport.UserPresenter
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	cfg := d.Config
	mail := func(ctx context.Context, m mailer.Message, key string) error {
		return mailer.Enqueue(ctx, d.Pool, m, key)
	}
	svc := service.New(service.DefaultConfig(cfg.PublicURL, cfg.RefreshTTL), d.Users, repository.New(d.Pool), d.Tokens, d.Bus, mail)

	providers := oauth.Registry{}
	if cfg.GoogleClientID != "" {
		providers["google"] = oauth.NewGoogle(cfg.GoogleClientID, cfg.GoogleClientSecret)
	}
	if cfg.GitHubClientID != "" {
		providers["github"] = oauth.NewGitHub(cfg.GitHubClientID, cfg.GitHubClientSecret)
	}

	h := transport.NewHandler(svc, d.Present, providers,
		transport.Config{PublicURL: cfg.PublicURL, CookieSecure: cfg.CookieSecure, SigningKey: cfg.SecretKeyBytes()},
		transport.Limiters{
			Login:    ratelimit.NewMemory(10, time.Minute),
			Register: ratelimit.NewMemory(5, 10*time.Minute),
			Email:    ratelimit.NewMemory(5, 15*time.Minute),
		})
	return &Module{Service: svc, HTTP: h}
}
