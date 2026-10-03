// Package wiki owns the team knowledge base: spaces, a tree of folders and pages, per-element
// visibility and grants, trash, favorites and an audit log (docs/adr/0014).
package wiki

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	Teams      service.Teams
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Teams)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
