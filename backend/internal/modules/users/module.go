// Package users owns user profiles (identity data lives here; credentials logic lives in auth).
package users

import (
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	transport "github.com/reliabilix/lecodekanban/backend/internal/modules/users/transport/http"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
)

type Deps struct {
	Pool *pgxpool.Pool
	Bus  *eventbus.Bus
	// Storage enables profile pictures (nil: no uploads).
	Storage service.Storage
}

type Module struct {
	Service *service.Service
	// HTTP is created later via NewHTTP because it needs ports implemented by the auth module.
}

func New(d Deps) *Module {
	svc := service.New(repository.New(d.Pool), d.Bus)
	if d.Storage != nil {
		svc.WithAvatars(d.Storage)
	}
	return &Module{Service: svc}
}

// NewHTTP builds the transport once the auth module (provider lister, password changer) exists.
func (m *Module) NewHTTP(providers transport.ProviderLister, passwords transport.PasswordChanger) *transport.Handler {
	return transport.NewHandler(m.Service, providers, passwords)
}
