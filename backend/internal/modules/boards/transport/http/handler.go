// Package http exposes boards, columns and saved views over REST.
package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/optional"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/projects/{projectId}/board", httpx.H(h.board))
	r.Post("/projects/{projectId}/board/columns", httpx.H(h.createColumn))
	r.Patch("/columns/{columnId}", httpx.H(h.updateColumn))
	r.Delete("/columns/{columnId}", httpx.H(h.deleteColumn))
	r.Post("/columns/{columnId}/move", httpx.H(h.moveColumn))
	r.Get("/workspaces/{workspaceId}/views", httpx.H(h.views))
	r.Post("/workspaces/{workspaceId}/views", httpx.H(h.createView))
	r.Patch("/views/{viewId}", httpx.H(h.updateView))
	r.Delete("/views/{viewId}", httpx.H(h.deleteView))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func param(r *http.Request, name string, code apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(code, "not found")
	}
	return id, nil
}

func columnToAPI(c domain.Column) api.BoardColumn {
	return api.BoardColumn{Id: c.ID, Name: c.Name, Status: api.TaskStatus(c.Category), Position: c.Position, WipLimit: c.WIPLimit}
}

func (h *Handler) board(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "projectId", domain.ErrBoardNotFound)
	if err != nil {
		return err
	}
	b, err := h.svc.Board(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := api.Board{Id: b.ID, ProjectId: b.ProjectID, Name: b.Name, Columns: make([]api.BoardColumn, len(b.Columns))}
	for i, c := range b.Columns {
		out.Columns[i] = columnToAPI(c)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createColumn(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "projectId", domain.ErrBoardNotFound)
	if err != nil {
		return err
	}
	var in api.ColumnInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	c, err := h.svc.CreateColumn(r.Context(), userID(r), id,
		service.NewColumn{Name: in.Name, Category: domain.Category(in.Status), WIPLimit: in.WipLimit})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, columnToAPI(c))
	return nil
}

type columnPatch struct {
	Name     optional.Field[string] `json:"name"`
	WIPLimit optional.Field[int]    `json:"wipLimit"`
}

func (h *Handler) updateColumn(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "columnId", domain.ErrColumnNotFound)
	if err != nil {
		return err
	}
	var in columnPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	c, err := h.svc.UpdateColumn(r.Context(), userID(r), id,
		repository.ColumnPatch{Name: in.Name.Ptr(), SetWIP: in.WIPLimit.Set, WIP: in.WIPLimit.Ptr()})
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, columnToAPI(c))
	return nil
}

func (h *Handler) moveColumn(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "columnId", domain.ErrColumnNotFound)
	if err != nil {
		return err
	}
	var in api.Neighbours
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	c, err := h.svc.MoveColumn(r.Context(), userID(r), id, in.AfterId, in.BeforeId)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, columnToAPI(c))
	return nil
}

func (h *Handler) deleteColumn(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "columnId", domain.ErrColumnNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteColumn(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func viewToAPI(v domain.SavedView) api.SavedView {
	out := api.SavedView{Id: v.ID, Name: v.Name, CreatedAt: v.CreatedAt, UpdatedAt: v.UpdatedAt, Config: map[string]any{}}
	_ = json.Unmarshal(v.Config, &out.Config)
	return out
}

func rawConfig(m map[string]any) json.RawMessage {
	if m == nil {
		return nil
	}
	b, _ := json.Marshal(m)
	return b
}

func (h *Handler) views(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.Views(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.SavedView, len(vs))
	for i, v := range vs {
		out[i] = viewToAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createView(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.SavedViewInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.CreateView(r.Context(), userID(r), ws, in.Name, rawConfig(in.Config))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, viewToAPI(v))
	return nil
}

func (h *Handler) updateView(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "viewId", domain.ErrViewNotFound)
	if err != nil {
		return err
	}
	var in api.SavedViewPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	var cfg json.RawMessage
	if in.Config != nil {
		cfg = rawConfig(*in.Config)
	}
	v, err := h.svc.UpdateView(r.Context(), userID(r), id, in.Name, cfg)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, viewToAPI(v))
	return nil
}

func (h *Handler) deleteView(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "viewId", domain.ErrViewNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteView(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
