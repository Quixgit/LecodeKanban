// Package templates owns task templates and recurring tasks.
package templates

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/templates/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/templates/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Cards      service.Cards
	Workspaces service.Workspaces
	Projects   service.Projects
	Log        *slog.Logger
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Cards, d.Workspaces, d.Projects, d.Log)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
