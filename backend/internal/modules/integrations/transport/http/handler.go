// Package http exposes integrations: the catalogue, connecting, settings and upcoming meetings.
package http

import (
	"net/http"
	"net/url"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/api"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/httpx"
)

type Handler struct {
	svc       *service.Service
	publicURL string
}

func NewHandler(svc *service.Service, publicURL string) *Handler {
	return &Handler{svc: svc, publicURL: publicURL}
}

func (h *Handler) PrivateRoutes(r chi.Router) {
	r.Get("/workspaces/{workspaceId}/integrations", httpx.H(h.list))
	r.Get("/workspaces/{workspaceId}/integrations/meetings", httpx.H(h.meetings))
	r.Post("/workspaces/{workspaceId}/integrations/{provider}/connect", httpx.H(h.connect))
	r.Patch("/workspaces/{workspaceId}/integrations/{provider}", httpx.H(h.update))
	r.Delete("/workspaces/{workspaceId}/integrations/{provider}", httpx.H(h.disconnect))
	r.Post("/workspaces/{workspaceId}/integrations/{provider}/sync", httpx.H(h.sync))
}

// PublicRoutes holds the OAuth callback: the browser arrives from the provider, and the signed
// state (not a session) says who is connecting.
func (h *Handler) PublicRoutes(r chi.Router) {
	r.Get("/integrations/{provider}/callback", h.callback)
}

func userID(r *http.Request) uuid.UUID {
	p, _ := authtoken.FromContext(r.Context())
	return p.UserID
}

func ids(r *http.Request) (ws uuid.UUID, p domain.Provider, err error) {
	ws, err = uuid.Parse(chi.URLParam(r, "workspaceId"))
	if err != nil {
		return uuid.Nil, "", apperr.New(wsdomain.ErrNotFound, "workspace not found")
	}
	p = domain.Provider(chi.URLParam(r, "provider"))
	if chi.URLParam(r, "provider") != "" && !p.Valid() {
		return uuid.Nil, "", apperr.New(domain.ErrNotConnected, "unknown integration")
	}
	return ws, p, nil
}

func entry(e service.Entry) api.IntegrationEntry {
	out := api.IntegrationEntry{Provider: api.IntegrationEntryProvider(e.Provider), Configured: e.Configured, RedirectUri: e.RedirectURI,
		LeadMinutes: 30, NotifyBell: true, Status: api.IntegrationEntryStatus(domain.Connected)}
	if in := e.Integration; in != nil {
		out.Connected, out.Enabled, out.AccountEmail = true, in.Enabled, in.AccountEmail
		out.LeadMinutes, out.NotifyBell, out.ChannelId = in.LeadMinutes, in.NotifyBell, in.ChannelID
		out.Status, out.LastError, out.LastSyncAt = api.IntegrationEntryStatus(in.Status), in.LastError, in.LastSyncAt
	}
	return out
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) error {
	ws, _, err := ids(r)
	if err != nil {
		return err
	}
	entries, err := h.svc.Catalog(r.Context(), userID(r), ws)
	if err != nil {
		return err
	}
	out := api.IntegrationList{Items: make([]api.IntegrationEntry, len(entries)), LeadChoices: domain.LeadChoices}
	for i, e := range entries {
		out.Items[i] = entry(e)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) meetings(w http.ResponseWriter, r *http.Request) error {
	ws, _, err := ids(r)
	if err != nil {
		return err
	}
	events, err := h.svc.Upcoming(r.Context(), userID(r), ws, 5)
	if err != nil {
		return err
	}
	out := api.MeetingList{Items: make([]api.Meeting, len(events))}
	for i, e := range events {
		attendees := e.Attendees
		if attendees == nil {
			attendees = []string{}
		}
		out.Items[i] = api.Meeting{Id: e.ID, Provider: api.MeetingProvider(domain.GoogleCalendar), Title: e.Title,
			StartsAt: e.StartsAt, EndsAt: e.EndsAt, Location: e.Location, Url: e.Open(), Attendees: attendees}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) connect(w http.ResponseWriter, r *http.Request) error {
	ws, p, err := ids(r)
	if err != nil {
		return err
	}
	u, err := h.svc.ConnectURL(r.Context(), userID(r), ws, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, api.IntegrationConnect{Url: u})
	return nil
}

func (h *Handler) entryOf(r *http.Request, ws uuid.UUID, p domain.Provider) (api.IntegrationEntry, error) {
	entries, err := h.svc.Catalog(r.Context(), userID(r), ws)
	if err != nil {
		return api.IntegrationEntry{}, err
	}
	for _, e := range entries {
		if e.Provider == p {
			return entry(e), nil
		}
	}
	return api.IntegrationEntry{}, apperr.New(domain.ErrNotConnected, "unknown integration")
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) error {
	ws, p, err := ids(r)
	if err != nil {
		return err
	}
	var in api.IntegrationPatch
	if err := httpx.DecodeJSON(w, r, &in); err != nil {
		return err
	}
	patch := service.Patch{Enabled: in.Enabled, LeadMinutes: in.LeadMinutes, NotifyBell: in.NotifyBell}
	if in.ChannelId != nil {
		patch.ChannelSet, patch.ChannelID = true, in.ChannelId
	}
	if in.ClearChannel != nil && *in.ClearChannel {
		patch.ChannelSet, patch.ChannelID = true, nil
	}
	if _, err := h.svc.Update(r.Context(), userID(r), ws, p, patch); err != nil {
		return err
	}
	out, err := h.entryOf(r, ws, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) disconnect(w http.ResponseWriter, r *http.Request) error {
	ws, p, err := ids(r)
	if err != nil {
		return err
	}
	if err := h.svc.Disconnect(r.Context(), userID(r), ws, p); err != nil {
		return err
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) sync(w http.ResponseWriter, r *http.Request) error {
	ws, p, err := ids(r)
	if err != nil {
		return err
	}
	if _, err := h.svc.SyncNow(r.Context(), userID(r), ws, p); err != nil {
		return err
	}
	out, err := h.entryOf(r, ws, p)
	if err != nil {
		return err
	}
	httpx.WriteJSON(w, http.StatusOK, out)
	return nil
}

func (h *Handler) callback(w http.ResponseWriter, r *http.Request) {
	back := func(q url.Values) {
		http.Redirect(w, r, h.publicURL+"/integrations?"+q.Encode(), http.StatusFound)
	}
	q := r.URL.Query()
	if q.Get("error") != "" {
		back(url.Values{"error": {"denied"}})
		return
	}
	p := domain.Provider(chi.URLParam(r, "provider"))
	if !p.Valid() {
		back(url.Values{"error": {"failed"}})
		return
	}
	if _, err := h.svc.Callback(r.Context(), p, q.Get("state"), q.Get("code")); err != nil {
		back(url.Values{"error": {"failed"}})
		return
	}
	back(url.Values{"connected": {string(p)}})
}
