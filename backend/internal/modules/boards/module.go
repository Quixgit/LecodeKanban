// Package boards owns boards and their columns (workflow lanes mapped onto statuses).
package boards

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(pool *pgxpool.Pool, auth service.Authorizer, bus *eventbus.Bus) *Module {
	svc := service.New(repository.New(pool), auth, bus)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
