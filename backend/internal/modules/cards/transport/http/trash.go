package http

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

func (h *Handler) trash(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var project *uuid.UUID
	if id, err := uuid.Parse(r.URL.Query().Get("projectId")); err == nil {
		project = &id
	}
	views, err := h.svc.Trash(r.Context(), userID(r), ws, project)
	if err != nil {
		return err
	}
	out := api.TrashList{Items: make([]api.TrashItem, len(views))}
	for i, v := range views {
		deleted := v.UpdatedAt
		if v.ArchivedAt != nil {
			deleted = *v.ArchivedAt
		}
		out.Items[i] = api.TrashItem{Card: ToAPI(v), DeletedAt: deleted}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	v, err := h.svc.Restore(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, ToAPI(v))
	return nil
}
