// Package http exposes workspaces, members and invites over REST.
package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct{ svc *service.Service }

func NewHandler(svc *service.Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) PublicRoutes(r chi.Router) {
	r.Get("/invites/{token}", httpx.H(h.previewInvite))
}

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces", httpx.H(h.list))
	r.Post("/workspaces", httpx.H(h.create))
	r.Route("/workspaces/{workspaceId}", func(r chi.Router) {
		r.Get("/", httpx.H(h.get))
		r.Patch("/", httpx.H(h.update))
		r.Delete("/", httpx.H(h.delete))
		r.Get("/members", httpx.H(h.members))
		r.Get("/settings", httpx.H(h.settings))
		r.Patch("/settings", httpx.H(h.updateSettings))
		r.Get("/audit", httpx.H(h.audit))
		r.Patch("/members/{userId}", httpx.H(h.changeRole))
		r.Delete("/members/{userId}", httpx.H(h.removeMember))
		r.Get("/invites", httpx.H(h.invites))
		r.Post("/invites", httpx.H(h.invite))
		r.Delete("/invites/{inviteId}", httpx.H(h.revokeInvite))
	})
	r.Post("/invites/{token}/accept", httpx.H(h.acceptInvite))
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func pathUUID(r *http.Request, name string, notFound apperr.Code) (uuid.UUID, error) {
	id, err := uuid.Parse(chi.URLParam(r, name))
	if err != nil {
		return uuid.Nil, apperr.New(notFound, "not found")
	}
	return id, nil
}

func toAPI(w domain.Workspace) api.Workspace {
	return api.Workspace{Id: w.ID, Name: w.Name, Slug: w.Slug, Role: api.Role(w.Role), MemberCount: w.MemberCount, CreatedAt: w.CreatedAt}
}

func inviteToAPI(i domain.Invite) api.Invite {
	return api.Invite{Id: i.ID, Email: i.Email, Role: api.InviteRole(i.Role), ExpiresAt: i.ExpiresAt, CreatedAt: i.CreatedAt}
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	list, err := h.svc.List(r.Context(), userID(r))
	if err != nil {
		return err
	}
	out := make([]api.Workspace, len(list))
	for i, ws := range list {
		out[i] = toAPI(ws)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) error {
	var in api.WorkspaceInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	ws, err := h.svc.Create(r.Context(), userID(r), in.Name)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, toAPI(ws))
	return nil
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) error {
	id, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	ws, err := h.svc.Get(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(ws))
	return nil
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	id, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.WorkspaceInput
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	ws, err := h.svc.Rename(r.Context(), userID(r), id, in.Name)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(ws))
	return nil
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) error {
	id, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.Delete(r.Context(), userID(r), id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) members(w http.ResponseWriter, r *http.Request) error {
	id, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	list, err := h.svc.Members(r.Context(), userID(r), id)
	if err != nil {
		return err
	}
	out := make([]api.Member, len(list))
	for i, m := range list {
		out[i] = api.Member{
			User:     api.MemberUser{Id: m.UserID, Name: m.Name, Email: m.Email, AvatarUrl: m.Avatar},
			Role:     api.Role(m.Role),
			JoinedAt: m.JoinedAt,
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) changeRole(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	target, err := pathUUID(r, "userId", domain.ErrMemberNotFound)
	if err != nil {
		return err
	}
	var in api.UpdateMemberRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	if err := h.svc.ChangeRole(r.Context(), userID(r), ws, target, domain.Role(in.Role)); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) removeMember(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	target, err := pathUUID(r, "userId", domain.ErrMemberNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.RemoveMember(r.Context(), userID(r), ws, target); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) invites(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	list, err := h.svc.Invites(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.Invite, len(list))
	for i, inv := range list {
		out[i] = inviteToAPI(inv)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.CreateInviteRequest
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	inv, err := h.svc.Invite(r.Context(), userID(r), ws, in.Email, domain.Role(in.Role))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusCreated, inviteToAPI(inv))
	return nil
}

func (h *Handler) revokeInvite(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	id, err := pathUUID(r, "inviteId", domain.ErrInviteNotFound)
	if err != nil {
		return err
	}
	if err := h.svc.RevokeInvite(r.Context(), userID(r), ws, id); err != nil {
		return err
	}
	httpx.NoContent(w)
	return nil
}

func (h *Handler) previewInvite(w http.ResponseWriter, r *http.Request) error {
	p, err := h.svc.Preview(r.Context(), chi.URLParam(r, "token"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.InvitePreview{
		WorkspaceName: p.WorkspaceName, InviterName: p.InviterName, Email: p.Email,
		Role: api.InviteRole(p.Role), Expired: p.Expired, Accepted: p.Accepted,
	})
	return nil
}

func (h *Handler) acceptInvite(w http.ResponseWriter, r *http.Request) error {
	ws, err := h.svc.Accept(r.Context(), userID(r), chi.URLParam(r, "token"))
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toAPI(ws))
	return nil
}

func toSettings(s domain.Settings) api.WorkspaceSettings {
	domains := s.AllowedDomains
	if domains == nil {
		domains = []string{}
	}
	return api.WorkspaceSettings{
		Description: s.Description, InviteBy: api.WorkspaceSettingsInviteBy(s.InviteBy), InviteDays: s.InviteDays,
		DefaultInviteRole: api.InviteRole(s.DefaultInviteRole), AllowedDomains: domains,
		ProjectCreateBy: api.WorkspaceSettingsProjectCreateBy(s.ProjectCreateBy), ChannelCreateBy: api.WorkspaceSettingsChannelCreateBy(s.ChannelCreateBy),
		BroadcastBy: api.WorkspaceSettingsBroadcastBy(s.BroadcastBy), DefaultPriority: api.WorkspaceSettingsDefaultPriority(s.DefaultPriority),
		RequireDueDate: s.RequireDueDate, WeekStart: s.WeekStart,
		Features: api.WorkspaceFeatures{Chat: s.Features.Chat, Docs: s.Features.Docs, Time: s.Features.Time,
			Calendar: s.Features.Calendar, Integrations: s.Features.Integrations},
	}
}

func (h *Handler) settings(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	s, err := h.svc.Settings(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toSettings(s))
	return nil
}

func (h *Handler) updateSettings(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	var in api.WorkspaceSettingsPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	p := domain.SettingsPatch{Description: in.Description, InviteDays: in.InviteDays, AllowedDomains: in.AllowedDomains,
		RequireDueDate: in.RequireDueDate, WeekStart: in.WeekStart}
	str := func(v *string) *string { return v }
	if in.InviteBy != nil {
		p.InviteBy = str((*string)(in.InviteBy))
	}
	if in.ProjectCreateBy != nil {
		p.ProjectCreateBy = str((*string)(in.ProjectCreateBy))
	}
	if in.ChannelCreateBy != nil {
		p.ChannelCreateBy = str((*string)(in.ChannelCreateBy))
	}
	if in.BroadcastBy != nil {
		p.BroadcastBy = str((*string)(in.BroadcastBy))
	}
	if in.DefaultPriority != nil {
		p.DefaultPriority = str((*string)(in.DefaultPriority))
	}
	if in.DefaultInviteRole != nil {
		role := domain.Role(*in.DefaultInviteRole)
		p.DefaultInviteRole = &role
	}
	if in.Features != nil {
		p.Features = &domain.Features{Chat: in.Features.Chat, Docs: in.Features.Docs, Time: in.Features.Time,
			Calendar: in.Features.Calendar, Integrations: in.Features.Integrations}
	}
	s, err := h.svc.UpdateSettings(r.Context(), userID(r), ws, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, toSettings(s))
	return nil
}

func (h *Handler) audit(w http.ResponseWriter, r *http.Request) error {
	ws, err := pathUUID(r, "workspaceId", domain.ErrNotFound)
	if err != nil {
		return err
	}
	list, err := h.svc.Audit(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := make([]api.AuditEntry, len(list))
	for i, e := range list {
		out[i] = api.AuditEntry{Id: e.ID, Action: e.Action, At: e.At, Details: e.Details}
		if e.Actor != nil {
			out[i].Actor = &api.PersonRef{Id: e.Actor.ID, Name: e.Actor.Name, AvatarUrl: e.Actor.AvatarURL}
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}
