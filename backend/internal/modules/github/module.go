// Package github connects a workspace to GitHub: projects link to repositories, pull requests and issues
// that mention task keys appear on the cards, merges move tasks, and the two sides follow each other
// (docs/adr/0020).
package github

import (
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/github/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
)

type Deps struct {
	Pool       *pgxpool.Pool
	Workspaces service.Workspaces
	GitHub     service.GitHub
	Cards      service.Cards
	Projects   service.Projects
	Sealer     *crypto.Sealer
	Hints      service.Hints
	PublicURL  string
	Log        *slog.Logger
}

type Module struct {
	Service *service.Service
	HTTP    *transport.Handler
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Workspaces, d.GitHub, d.Cards, d.Projects, d.Sealer, d.Hints, d.PublicURL, d.Log)
	return &Module{Service: svc, HTTP: transport.NewHandler(svc)}
}
