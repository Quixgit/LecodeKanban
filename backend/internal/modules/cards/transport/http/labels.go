package http

import (
	"net/http"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

func labelToAPI(l domain.Label) api.Label {
	return api.Label{Id: l.ID, Name: l.Name, Tone: api.Tone(l.Tone)}
}

func (h *Handler) labels(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	ls, err := h.svc.Labels(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.Label, len(ls))
	for i, l := range ls {
		out[i] = labelToAPI(l)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createLabel(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.LabelInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	tone := ""
	if in.Tone != nil {
		tone = string(*in.Tone)
	}
	l, err := h.svc.CreateLabel(r.Context(), userID(r), ws, in.Name, tone)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, labelToAPI(l))
	return nil
}

func (h *Handler) updateLabel(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "labelId", domain.ErrLabelNotFound)
	if err != nil {
		return err
	}
	var in api.LabelPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	var tone *string
	if in.Tone != nil {
		t := string(*in.Tone)
		tone = &t
	}
	l, err := h.svc.UpdateLabel(r.Context(), userID(r), id, in.Name, tone)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, labelToAPI(l))
	return nil
}

func (h *Handler) deleteLabel(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "labelId", domain.ErrLabelNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.DeleteLabel(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
