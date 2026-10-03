// Package integrations owns connections to outside accounts, starting with Google Calendar: people
// connect an account, activate or pause it, and get meeting reminders (docs/adr/0019).
package integrations

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	Calendar   service.Calendar
	Sealer     *crypto.Sealer
	Notices    service.Notices
	Channels   service.Channels
	Hints      service.Hints
	PublicURL  string
	Log        *slog.Logger
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Calendar, d.Sealer, d.Notices, d.Channels, d.Hints, d.PublicURL, d.Log)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc, d.PublicURL)}
}
