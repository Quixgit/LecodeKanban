// Package workspaces owns workspaces, memberships, roles (RBAC) and invitations.
package workspaces

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

type Deps struct {
	Pool      *pgxpool.Pool
	Bus       *eventbus.Bus
	Users     service.Users
	PublicURL string
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	mail := func(ctx context.Context, m mailer.Message, key string) error {
		return mailer.Enqueue(ctx, d.Pool, m, key)
	}
	svc := service.New(repository.New(d.Pool), d.Users, d.Bus, mail, d.PublicURL)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
