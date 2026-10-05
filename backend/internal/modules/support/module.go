// Package support owns the requests people send to the administrators of their workspace.
package support

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/support/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	Users      service.Users
	Mail       service.MailQueue
	Log        *slog.Logger
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Users, d.Mail, d.Log)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
