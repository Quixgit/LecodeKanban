// Package attachments owns files attached to cards, behind a pluggable domain.Storage.
package attachments

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Bus        *eventbus.Bus
	Storage    domain.Storage
	MaxBytes   int64
	Cards      service.Cards
	Workspaces service.Workspaces
	Users      service.Users
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Storage, d.Cards, d.Workspaces, d.Users, d.Bus, d.MaxBytes)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
