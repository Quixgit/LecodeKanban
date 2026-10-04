// Package http exposes custom fields over REST.
package http

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/custom-fields", httpx.H(h.list))
	r.Post("/workspaces/{workspaceId}/custom-fields", httpx.H(h.create))
	r.Put("/workspaces/{workspaceId}/custom-fields/order", httpx.H(h.reorder))
	r.Post("/workspaces/{workspaceId}/custom-fields/values", httpx.H(h.values))
	r.Patch("/custom-fields/{fieldId}", httpx.H(h.update))
	r.Delete("/custom-fields/{fieldId}", httpx.H(h.remove))
	r.Get("/cards/{cardId}/field-values", httpx.H(h.cardValues))
	r.Put("/cards/{cardId}/field-values/{fieldId}", httpx.H(h.setValue))
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

func toAPI(f domain.Field) api.CustomField {
	opts := make([]api.FieldOption, len(f.Options))
	for i, o := range f.Options {
		opts[i] = api.FieldOption{Id: o.ID, Label: o.Label, Tone: api.Tone(o.Tone)}
	}
	return api.CustomField{Id: f.ID, Name: f.Name, Description: f.Description, Kind: api.CustomFieldKind(f.Kind),
		Options: opts, ShowOnCard: f.ShowOnCard, Position: f.Position}
}

func options(in []api.FieldOption) []domain.Option {
	out := make([]domain.Option, len(in))
	for i, o := range in {
		out[i] = domain.Option{ID: o.Id, Label: o.Label, Tone: string(o.Tone)}
	}
	return out
}

func valuesAPI(vs []domain.Value) []api.CardFieldValue {
	out := make([]api.CardFieldValue, len(vs))
	for i, v := range vs {
		out[i] = api.CardFieldValue{CardId: v.CardID, FieldId: v.FieldID, Value: v.Value}
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	fs, err := h.svc.List(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.CustomField, len(fs))
	for i, f := range fs {
		out[i] = toAPI(f)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CustomFieldInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	nf := domain.NewField{Name: in.Name, Kind: domain.Kind(in.Kind)}
	if in.Description != nil {
		nf.Description = *in.Description
	}
	if in.Options != nil {
		nf.Options = options(*in.Options)
	}
	if in.ShowOnCard != nil {
		nf.ShowOnCard = *in.ShowOnCard
	}
	f, err := h.svc.Create(r.Context(), userID(r), ws, nf)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(f))
	return nil
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "fieldId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CustomFieldPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	p := domain.FieldPatch{Name: in.Name, Description: in.Description, ShowOnCard: in.ShowOnCard}
	if in.Options != nil {
		o := options(*in.Options)
		p.Options = &o
	}
	f, err := h.svc.Update(r.Context(), userID(r), id, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(f))
	return nil
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "fieldId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) reorder(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in struct {
		IDs []uuid.UUID `json:"ids"`
	}
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.Reorder(r.Context(), userID(r), ws, in.IDs); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) values(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in struct {
		CardIDs []uuid.UUID `json:"cardIds"`
	}
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	vs, err := h.svc.ValuesForCards(r.Context(), userID(r), ws, in.CardIDs)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, valuesAPI(vs))
	return nil
}

func (h *Handler) cardValues(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.CardValues(r.Context(), userID(r), card)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, valuesAPI(vs))
	return nil
}

func (h *Handler) setValue(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	field, err := param(r, "fieldId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in struct {
		Value json.RawMessage `json:"value"`
	}
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.SetValue(r.Context(), userID(r), card, field, in.Value); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
