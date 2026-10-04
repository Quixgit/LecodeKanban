// Package customfields owns workspace-defined fields for cards: definitions and per-card values.
package customfields

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Cards      service.Cards
	Workspaces service.Workspaces
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Cards, d.Workspaces)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
