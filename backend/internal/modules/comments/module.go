// Package comments owns card comments and @mentions.
package comments

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Bus        *eventbus.Bus
	Cards      service.Cards
	Workspaces service.Workspaces
	Users      service.Users
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Cards, d.Workspaces, d.Users, d.Bus)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
