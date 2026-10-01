package http

import (
	"net/http"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

func itemToAPI(i domain.ChecklistItem) api.ChecklistItem {
	return api.ChecklistItem{Id: i.ID, Text: i.Text, Done: i.Done, Position: i.Position, CompletedAt: i.CompletedAt}
}

func (h *Handler) checklist(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	items, err := h.svc.Checklist(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := make([]api.ChecklistItem, len(items))
	for i, it := range items {
		out[i] = itemToAPI(it)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) addItem(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "cardId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChecklistItemInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	item, err := h.svc.AddChecklistItem(r.Context(), userID(r), id, in.Text)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, itemToAPI(item))
	return nil
}

func (h *Handler) updateItem(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "itemId", domain.ErrItemNotFound)
	if err != nil {
		return err
	}
	var in api.ChecklistItemPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	p := service.ItemPatch{Text: in.Text, Done: in.Done}
	if in.Move != nil {
		p.Move, p.AfterID, p.BeforeID = true, in.Move.AfterId, in.Move.BeforeId
	}
	item, err := h.svc.UpdateChecklistItem(r.Context(), userID(r), id, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, itemToAPI(item))
	return nil
}

func (h *Handler) deleteItem(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "itemId", domain.ErrItemNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteChecklistItem(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
