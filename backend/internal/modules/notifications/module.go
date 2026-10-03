// Package notifications owns the bell: per-person notifications built from other modules' events
// (docs/adr/0018).
package notifications

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	Users      service.Users
	Cards      service.Cards
	Projects   service.Projects
	Hints      service.Hints
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Users, d.Cards, d.Projects, d.Hints)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
