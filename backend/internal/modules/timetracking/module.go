// Package timetracking owns work logged against cards: timers and manual entries.
package timetracking

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Cards      service.Cards
	Workspaces service.Workspaces
	Users      service.Users
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Cards, d.Workspaces, d.Users)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
