// Package http exposes card comments over REST.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/comments/service"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/cards/{cardId}/comments", httpx.H(h.list))
	r.Post("/cards/{cardId}/comments", httpx.H(h.create))
	r.Patch("/comments/{commentId}", httpx.H(h.update))
	r.Delete("/comments/{commentId}", httpx.H(h.delete))
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

func person(u usersdomain.User) api.PersonRef {
	return api.PersonRef{Id: u.ID, Name: u.Name, AvatarUrl: u.AvatarURL}
}

func toAPI(v service.View) api.Comment {
	out := api.Comment{Id: v.ID, CardId: v.CardID, Body: v.Body, CreatedAt: v.CreatedAt, EditedAt: v.EditedAt,
		Mentions: make([]api.PersonRef, len(v.Mentioned))}
	if v.Author != nil {
		p := person(*v.Author)
		out.Author = &p
	}
	for i, u := range v.Mentioned {
		out.Mentions[i] = person(u)
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.List(r.Context(), userID(r), card)
	if err != nil {
		return err
	}
	out := make([]api.Comment, len(vs))
	for i, v := range vs {
		out[i] = toAPI(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	card, err := param(r, "cardId", carddomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CommentInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Create(r.Context(), userID(r), card, in.Body)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(v))
	return nil
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "commentId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CommentInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, in.Body)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(v))
	return nil
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "commentId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}
