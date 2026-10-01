// Package activity owns the audit log / activity feed, filled from other modules' events.
package activity

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/activity/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/transport/http"
)

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(pool *pgxpool.Pool, cards service.Cards, users service.Users) *Module {
	svc := service.New(repository.New(pool), cards, users)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
