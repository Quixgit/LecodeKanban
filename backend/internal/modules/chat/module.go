// Package chat owns team chat: channels, direct messages, threads, reactions and read state
// (docs/adr/0016).
package chat

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/transport/http"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	Users      service.Users
	Hints      service.Hints
	Projects   service.Projects
	Cards      service.Cards
	// Storage and MaxUploadBytes enable attachments.
	Storage        service.Storage
	MaxUploadBytes int64
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.Users, d.Hints).WithScopes(d.Projects, d.Cards)
	if d.Storage != nil {
		svc.WithFiles(d.Storage, d.MaxUploadBytes)
	}
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
