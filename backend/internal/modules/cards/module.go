// Package cards owns cards (tasks): content, assignees, ordering and status history.
package cards

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Bus        *eventbus.Bus
	Workspaces service.Workspaces
	Projects   service.Projects
	Boards     service.Boards
	Users      service.Users
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Projects, d.Boards, d.Users, d.Bus)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
