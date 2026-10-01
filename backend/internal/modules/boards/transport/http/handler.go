// Package http exposes boards over REST.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/projects/{projectId}/board", httpx.H(h.board))
}

func (h *Handler) board(w http.ResponseWriter, r *http.Request) error {
	id, err := uuid.Parse(chi.URLParam(r, "projectId"))
	if err != nil {
		return apperr.New(domain.ErrBoardNotFound, "board not found")
	}
	p, _ := authtoken.FromContext(r.Context())
	b, err := h.svc.Board(r.Context(), p.UserID, id)
	if err != nil {
		return err
	}
	out := api.Board{Id: b.ID, ProjectId: b.ProjectID, Name: b.Name, Columns: make([]api.BoardColumn, len(b.Columns))}
	for i, c := range b.Columns {
		out.Columns[i] = api.BoardColumn{Id: c.ID, Name: c.Name, Status: api.TaskStatus(c.Category), Position: c.Position, WipLimit: c.WIPLimit}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}
