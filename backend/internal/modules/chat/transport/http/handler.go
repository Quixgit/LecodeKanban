// Package http exposes chat over REST.
package http

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/chat/channels", httpx.H(h.channels))
	r.Post("/workspaces/{workspaceId}/chat/channels", httpx.H(h.createChannel))
	r.Post("/workspaces/{workspaceId}/chat/direct", httpx.H(h.openDirect))
	r.Post("/projects/{projectId}/chat", httpx.H(h.scope(domain.Project, "projectId", projectsdomain.ErrNotFound)))
	r.Post("/cards/{cardId}/chat", httpx.H(h.scope(domain.Card, "cardId", carddomain.ErrNotFound)))
	r.Patch("/chat/channels/{channelId}", httpx.H(h.updateChannel))
	r.Delete("/chat/channels/{channelId}", httpx.H(h.archiveChannel))
	r.Get("/chat/channels/{channelId}/members", httpx.H(h.members))
	r.Post("/chat/channels/{channelId}/members", httpx.H(h.addMembers))
	r.Post("/chat/channels/{channelId}/join", httpx.H(h.join))
	r.Post("/chat/channels/{channelId}/leave", httpx.H(h.leave))
	r.Post("/chat/channels/{channelId}/read", httpx.H(h.read))
	r.Put("/chat/channels/{channelId}/mute", httpx.H(h.mute))
	r.Get("/chat/channels/{channelId}/messages", httpx.H(h.messages))
	r.Post("/chat/channels/{channelId}/messages", httpx.H(h.post))
	r.Patch("/chat/messages/{messageId}", httpx.H(h.edit))
	r.Delete("/chat/messages/{messageId}", httpx.H(h.deleteMessage))
	r.Get("/chat/messages/{messageId}/thread", httpx.H(h.thread))
	r.Put("/chat/messages/{messageId}/reactions/{key}", httpx.H(h.react(true)))
	r.Delete("/chat/messages/{messageId}/reactions/{key}", httpx.H(h.react(false)))
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

func people(us []usersdomain.User) []api.PersonRef {
	out := make([]api.PersonRef, len(us))
	for i, u := range us {
		out[i] = person(u)
	}
	return out
}

func toChannel(v service.ChannelView) api.ChatChannel {
	out := api.ChatChannel{Id: v.ID, WorkspaceId: v.WorkspaceID, Kind: api.ChatChannelKind(v.Kind), Topic: v.Topic,
		Joined: v.Joined, Muted: v.Muted, Unread: v.Unread, Mentions: v.Mentions, MemberCount: v.MemberCount,
		LastMessageAt: v.LastMessageAt, People: people(v.People)}
	if v.Name != "" {
		n := v.Name
		out.Name = &n
	}
	return out
}

func toMessage(v service.MessageView) api.ChatMessage {
	out := api.ChatMessage{Id: v.ID, ChannelId: v.ChannelID, ParentId: v.ParentID, Body: v.Body, Deleted: v.Deleted(),
		Mentions: people(v.Mentioned), ReplyCount: v.ReplyCount, LastReplyAt: v.LastReplyAt, CreatedAt: v.CreatedAt,
		EditedAt: v.EditedAt, Reactions: make([]api.ChatReaction, len(v.Reactions))}
	if v.Author != nil {
		p := person(*v.Author)
		out.Author = &p
	}
	for i, x := range v.Reactions {
		out.Reactions[i] = api.ChatReaction{Key: x.Key, Count: x.Count, Mine: x.Mine, Users: x.Users}
	}
	return out
}

func (h *Handler) channels(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.Channels(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.ChatChannel, len(vs))
	for i, v := range vs {
		out[i] = toChannel(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) createChannel(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatChannelInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	si := service.ChannelInput{Name: in.Name}
	if in.Topic != nil {
		si.Topic = *in.Topic
	}
	if in.Private != nil {
		si.Private = *in.Private
	}
	if in.MemberIds != nil {
		si.MemberIDs = *in.MemberIds
	}
	v, err := h.svc.CreateChannel(r.Context(), userID(r), ws, si)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toChannel(v))
	return nil
}

func (h *Handler) openDirect(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatDirectInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.OpenDM(r.Context(), userID(r), ws, in.UserIds)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toChannel(v))
	return nil
}

func (h *Handler) updateChannel(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatChannelPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, in.Name, in.Topic)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toChannel(v))
	return nil
}

func (h *Handler) archiveChannel(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Archive(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) members(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	us, err := h.svc.Members(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, people(us))
	return nil
}

func (h *Handler) addMembers(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatMembersInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.AddMembers(r.Context(), userID(r), id, in.UserIds); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) join(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	v, err := h.svc.Join(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toChannel(v))
	return nil
}

func (h *Handler) leave(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Leave(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) read(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.MarkRead(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) mute(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatMuteInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.SetMuted(r.Context(), userID(r), id, in.Muted); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) messages(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var before *uuid.UUID
	if s := r.URL.Query().Get("before"); s != "" {
		b, err := uuid.Parse(s)
		if err != nil {
			return apperr.New(domain.ErrNotFound, "not found")
		}
		before = &b
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	page, err := h.svc.Messages(r.Context(), userID(r), id, before, limit)
	if err != nil {
		return err
	}
	out := api.ChatMessagePage{HasMore: page.HasMore, Messages: make([]api.ChatMessage, len(page.Messages))}
	for i, m := range page.Messages {
		out.Messages[i] = toMessage(m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) post(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatMessageInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Post(r.Context(), userID(r), id, in.ParentId, in.Body)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toMessage(v))
	return nil
}

func (h *Handler) edit(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "messageId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatBodyInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	v, err := h.svc.Edit(r.Context(), userID(r), id, in.Body)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toMessage(v))
	return nil
}

func (h *Handler) deleteMessage(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "messageId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) thread(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "messageId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.Thread(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := make([]api.ChatMessage, len(vs))
	for i, v := range vs {
		out[i] = toMessage(v)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) react(on bool) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		id, err := param(r, "messageId", domain.ErrNotFound)
		if err != nil {
			return err
		}
		v, err := h.svc.React(r.Context(), userID(r), id, chi.URLParam(r, "key"), on)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, toMessage(v))
		return nil
	}
}

func (h *Handler) scope(kind domain.Kind, param_ string, notFound apperr.Code) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		ref, err := param(r, param_, notFound)
		if err != nil {
			return err
		}
		v, err := h.svc.ScopeChannel(r.Context(), userID(r), kind, ref)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, toChannel(v))
		return nil
	}
}
