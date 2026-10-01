// Package projects owns projects: metadata, PIC, team, deadlines and progress counters.
package projects

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Bus        *eventbus.Bus
	Workspaces service.Workspaces
	Boards     service.Boards
	Users      service.Users
	Locale     transport.LocaleOf
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Boards, d.Users, d.Bus)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc, d.Locale)}
}
