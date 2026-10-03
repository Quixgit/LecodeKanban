// Package http exposes chat over REST.
package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"
	"time"

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
	r.Get("/workspaces/{workspaceId}/chat/search", httpx.H(h.search))
	r.Get("/workspaces/{workspaceId}/chat/saved", httpx.H(h.hitsHandler(func(ctx context.Context, u, ws uuid.UUID) ([]service.Hit, error) {
		return h.svc.Saved(ctx, u, ws)
	})))
	r.Get("/workspaces/{workspaceId}/chat/threads", httpx.H(h.hitsHandler(func(ctx context.Context, u, ws uuid.UUID) ([]service.Hit, error) {
		return h.svc.Threads(ctx, u, ws)
	})))
	r.Get("/workspaces/{workspaceId}/chat/presence", httpx.H(h.online))
	r.Post("/workspaces/{workspaceId}/chat/presence", httpx.H(h.heartbeat))
	r.Put("/workspaces/{workspaceId}/chat/status", httpx.H(h.setStatus))
	r.Delete("/workspaces/{workspaceId}/chat/status", httpx.H(h.clearStatus))
	r.Post("/chat/channels/{channelId}/typing", httpx.H(h.typing))
	r.Put("/chat/channels/{channelId}/star", httpx.H(h.star(true)))
	r.Delete("/chat/channels/{channelId}/star", httpx.H(h.star(false)))
	r.Get("/chat/channels/{channelId}/pins", httpx.H(h.pins))
	r.Get("/chat/channels/{channelId}/files", httpx.H(h.channelFiles))
	r.Post("/chat/channels/{channelId}/files", httpx.H(h.uploadFile))
	r.Get("/chat/files/{fileId}/content", httpx.H(h.downloadFile))
	r.Put("/chat/messages/{messageId}/save", httpx.H(h.flag(h.svc.Save)))
	r.Delete("/chat/messages/{messageId}/save", httpx.H(h.flag(func(c context.Context, u, m uuid.UUID, _ bool) (service.MessageView, error) {
		return h.svc.Save(c, u, m, false)
	})))
	r.Put("/chat/messages/{messageId}/pin", httpx.H(h.flag(h.svc.Pin)))
	r.Delete("/chat/messages/{messageId}/pin", httpx.H(h.flag(func(c context.Context, u, m uuid.UUID, _ bool) (service.MessageView, error) {
		return h.svc.Pin(c, u, m, false)
	})))
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
		Joined: v.Joined, Muted: v.Muted, Starred: v.Starred, Feed: v.Feed, FeedProjectId: v.FeedProjectID, Unread: v.Unread, Mentions: v.Mentions, MemberCount: v.MemberCount,
		LastMessageAt: v.LastMessageAt, People: people(v.People)}
	if v.Name != "" {
		n := v.Name
		out.Name = &n
	}
	return out
}

func toMessage(v service.MessageView) api.ChatMessage {
	out := api.ChatMessage{Id: v.ID, ChannelId: v.ChannelID, ParentId: v.ParentID, Body: v.Body, Deleted: v.Deleted(),
		Mentions: people(v.Mentioned), MentionAll: v.MentionAll, ReplyCount: v.ReplyCount, LastReplyAt: v.LastReplyAt,
		CreatedAt: v.CreatedAt, EditedAt: v.EditedAt, Reactions: make([]api.ChatReaction, len(v.Reactions)),
		Files: make([]api.ChatFile, len(v.Files)), Pinned: v.Pinned, Saved: v.Saved, ReplyPeople: people(v.ReplyPeople)}
	for i, f := range v.Files {
		out.Files[i] = toFile(f)
	}
	if len(v.Event) > 0 {
		var ev api.ChatEvent
		if json.Unmarshal(v.Event, &ev) == nil {
			out.Event = &ev
		}
	}
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
	if in.Feed != nil {
		si.Feed, si.FeedProjectID = *in.Feed, in.FeedProjectId
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
	var feed *service.FeedPatch
	if in.Feed != nil {
		feed = &service.FeedPatch{On: *in.Feed, ProjectID: in.FeedProjectId}
	}
	v, err := h.svc.Update(r.Context(), userID(r), id, in.Name, in.Topic, feed)
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
	var files []uuid.UUID
	if in.FileIds != nil {
		files = *in.FileIds
	}
	v, err := h.svc.Post(r.Context(), userID(r), id, in.ParentId, in.Body, files)
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

func toFile(f domain.File) api.ChatFile {
	return api.ChatFile{Id: f.ID, Name: f.Name, ContentType: f.ContentType, Size: f.Size, CreatedAt: f.CreatedAt,
		Url: "/api/v1/chat/files/" + f.ID.String() + "/content"}
}

func (h *Handler) hitsHandler(fn func(context.Context, uuid.UUID, uuid.UUID) ([]service.Hit, error)) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
		if err != nil {
			return err
		}
		hits, err := fn(r.Context(), userID(r), ws)
		if err != nil {
			return err
		}
		out := make([]api.ChatHit, len(hits))
		for i, x := range hits {
			out[i] = api.ChatHit{Message: toMessage(x.MessageView), Channel: toChannel(x.Channel)}
		}
		httpx.WriteJSON(w, http.StatusOK, out)
		return nil
	}
}

func (h *Handler) online(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	ids, err := h.svc.Online(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	sts, err := h.svc.Statuses(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := api.ChatPresence{Online: ids, Statuses: make([]api.ChatStatus, len(sts))}
	for i, st := range sts {
		out.Statuses[i] = api.ChatStatus{UserId: st.UserID, Kind: api.ChatStatusKind(st.Kind), Text: st.Text, Until: st.Until}
		if st.Icon != "" {
			icon := api.ChatStatusIcon(st.Icon)
			out.Statuses[i].Icon = &icon
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) setStatus(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.ChatStatusInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	st := domain.Status{Kind: domain.StatusKind(in.Kind), Until: in.Until}
	if in.Icon != nil {
		st.Icon = string(*in.Icon)
	}
	if in.Text != nil {
		st.Text = *in.Text
	}
	if err := h.svc.SetStatus(r.Context(), userID(r), ws, st); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) clearStatus(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.ClearStatus(r.Context(), userID(r), ws); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) heartbeat(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Heartbeat(r.Context(), userID(r), ws); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) typing(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Typing(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) star(on bool) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		id, err := param(r, "channelId", domain.ErrNotFound)
		if err != nil {
			return err
		}
		if err := h.svc.Star(r.Context(), userID(r), id, on); err != nil {
			return err
		}
		httpx.NoContent(w)
		return nil
	}
}

func (h *Handler) pins(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	vs, err := h.svc.Pins(r.Context(), userID(r), id)
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

// flag adapts save and pin (which toggle with PUT and DELETE) to HTTP.
func (h *Handler) flag(fn func(context.Context, uuid.UUID, uuid.UUID, bool) (service.MessageView, error)) httpx.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) error {
		id, err := param(r, "messageId", domain.ErrNotFound)
		if err != nil {
			return err
		}
		v, err := fn(r.Context(), userID(r), id, true)
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusOK, toMessage(v))
		return nil
	}
}

func (h *Handler) channelFiles(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	fs, err := h.svc.ChannelFiles(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := make([]api.ChatFile, len(fs))
	for i, f := range fs {
		out[i] = toFile(f)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

// uploadFile streams the first "file" part of a multipart body straight to storage.
func (h *Handler) uploadFile(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "channelId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	max := h.svc.MaxUploadBytes()
	r.Body = http.MaxBytesReader(w, r.Body, max+1<<20)
	mr, err := r.MultipartReader()
	if err != nil {
		return apperr.New(domain.ErrNoFile, "expected multipart/form-data with a file part")
	}
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			return apperr.New(domain.ErrNoFile, "no file part")
		}
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			return apperr.New(apperr.TooLarge, "file is too large").WithMeta("maxBytes", max)
		}
		if err != nil {
			return apperr.New(domain.ErrNoFile, "malformed multipart body")
		}
		if part.FormName() != "file" || part.FileName() == "" {
			_ = part.Close()
			continue
		}
		f, err := h.svc.UploadFile(r.Context(), userID(r), id, part.FileName(), part)
		_ = part.Close()
		if errors.As(err, &tooBig) {
			return apperr.New(apperr.TooLarge, "file is too large").WithMeta("maxBytes", max)
		}
		if err != nil {
			return err
		}
		httpx.WriteJSON(w, http.StatusCreated, toFile(f))
		return nil
	}
}

// downloadFile serves bytes as a download by default; only known image types may be shown inline,
// and a sandbox CSP neutralises anything a browser might try to execute.
func (h *Handler) downloadFile(w http.ResponseWriter, r *http.Request) error {
	id, err := param(r, "fileId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	f, rc, err := h.svc.OpenFile(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	defer func() { _ = rc.Close() }()
	disposition, ctype := "attachment", "application/octet-stream"
	if domain.InlineImageTypes[f.ContentType] {
		ctype = f.ContentType
		if r.URL.Query().Get("inline") == "true" {
			disposition = "inline"
		}
	}
	hd := w.Header()
	hd.Set("Content-Type", ctype)
	hd.Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": f.Name}))
	hd.Set("Content-Security-Policy", "sandbox; default-src 'none'")
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Cache-Control", "private, max-age=3600")
	http.ServeContent(w, r, "", f.CreatedAt, rc)
	return nil
}

func queryUUID(r *http.Request, name string) (*uuid.UUID, error) {
	v := r.URL.Query().Get(name)
	if v == "" {
		return nil, nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil, apperr.New(domain.ErrNotFound, "not found")
	}
	return &id, nil
}

func queryTime(r *http.Request, name string) *time.Time {
	t, err := time.Parse(time.RFC3339, r.URL.Query().Get(name))
	if err != nil {
		return nil
	}
	return &t
}

// search parses Slack-style modifiers from the query string.
func (h *Handler) search(w http.ResponseWriter, r *http.Request) error {
	ws, err := param(r, "workspaceId", wsdomain.ErrNotFound)
	if err != nil {
		return err
	}
	q := r.URL.Query()
	in := service.SearchQuery{Q: q.Get("q"), MentionsMe: q.Get("mentionsMe") == "true", HasLink: q.Get("hasLink") == "true",
		HasFile: q.Get("hasFile") == "true", ThreadsOnly: q.Get("threadsOnly") == "true",
		After: queryTime(r, "after"), Before: queryTime(r, "before")}
	if in.ChannelID, err = queryUUID(r, "channelId"); err != nil {
		return err
	}
	if in.FromID, err = queryUUID(r, "fromId"); err != nil {
		return err
	}
	hits, err := h.svc.Search(r.Context(), userID(r), ws, in)
	if err != nil {
		return err
	}
	out := make([]api.ChatHit, len(hits))
	for i, x := range hits {
		out[i] = api.ChatHit{Message: toMessage(x.MessageView), Channel: toChannel(x.Channel)}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}
