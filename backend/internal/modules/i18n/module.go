// Package i18n exposes the catalog of translatable error codes. Clients translate
// codes (never server text); a test asserts every code has en + uk translations.
package i18n

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Module struct{}

func New() *Module { return &Module{} }

func (m *Module) PublicRoutes(r chi.Router) {
	r.Get("/i18n/error-codes", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, apperr.Codes())
	})
}
