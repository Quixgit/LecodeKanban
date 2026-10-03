// Package service connects outside accounts, keeps their calendars in sync and sends meeting reminders.
package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/repository"
	notifdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Calendar is the outside calendar service (the google package satisfies it).
type Calendar interface {
	Configured() bool
	AuthURL(state, redirect string) string
	Exchange(ctx context.Context, code, redirect string) (token, email string, err error)
	Events(ctx context.Context, refreshToken string, from, to time.Time) ([]domain.Event, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Role, error)
}

// Notices rings the bell (the notifications service satisfies it).
type Notices interface {
	Notify(ctx context.Context, n notifdomain.Notification) error
}

// MeetingPost is a reminder on its way into a chat channel.
type MeetingPost struct {
	Title       string
	StartsAt    time.Time
	EndsAt      time.Time
	Location    string
	Link        string
	LeadMinutes int
	Attendees   int
}

// Channels posts into chat (an adapter over the chat service).
type Channels interface {
	// CanPost checks the person may write in the channel and returns its workspace.
	CanPost(ctx context.Context, user, channel uuid.UUID) (uuid.UUID, error)
	PostMeeting(ctx context.Context, ws, channel uuid.UUID, m MeetingPost) error
}

type Hints interface {
	Publish(ctx context.Context, m realtime.Message)
}

const (
	stateTTL   = 10 * time.Minute
	syncEvery  = 5 * time.Minute
	lookBehind = time.Hour
	lookAhead  = 7 * 24 * time.Hour
)

type Service struct {
	repo      *repository.Repo
	ws        Workspaces
	cal       Calendar
	sealer    *crypto.Sealer
	notices   Notices
	channels  Channels
	hints     Hints
	publicURL string
	log       *slog.Logger
	now       func() time.Time
}

func New(repo *repository.Repo, ws Workspaces, cal Calendar, sealer *crypto.Sealer, notices Notices, channels Channels,
	hints Hints, publicURL string, log *slog.Logger) *Service {
	return &Service{repo: repo, ws: ws, cal: cal, sealer: sealer, notices: notices, channels: channels, hints: hints,
		publicURL: publicURL, log: log, now: time.Now}
}

// WithClock replaces the clock (tests).
func (s *Service) WithClock(now func() time.Time) *Service {
	s.now = now
	return s
}

// RedirectURL is the address Google sends people back to; it must be registered in the Google console.
func (s *Service) RedirectURL(p domain.Provider) string {
	return s.publicURL + "/api/v1/integrations/" + string(p) + "/callback"
}

func aad(user uuid.UUID, p domain.Provider) []byte {
	return []byte("integrations|" + user.String() + "|" + string(p))
}

func (s *Service) hint(ctx context.Context, ws, user uuid.UUID) {
	if s.hints != nil {
		s.hints.Publish(ctx, realtime.Message{Type: "integration", WorkspaceID: ws, UserID: &user})
	}
}

// Entry is one row of the catalogue: what can be connected and where it stands for this person.
type Entry struct {
	Provider    domain.Provider
	Configured  bool
	RedirectURI string
	Integration *domain.Integration
}

func (s *Service) Catalog(ctx context.Context, user, ws uuid.UUID) ([]Entry, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	have, err := s.repo.List(ctx, user, ws)
	if err != nil {
		return nil, err
	}
	out := make([]Entry, 0, len(domain.Providers))
	for _, p := range domain.Providers {
		e := Entry{Provider: p, Configured: s.cal.Configured(), RedirectURI: s.RedirectURL(p)}
		for i := range have {
			if have[i].Provider == p {
				e.Integration = &have[i]
			}
		}
		out = append(out, e)
	}
	return out, nil
}

type statePayload struct {
	User uuid.UUID       `json:"u"`
	WS   uuid.UUID       `json:"w"`
	P    domain.Provider `json:"p"`
	Exp  int64           `json:"e"`
}

// ConnectURL starts the OAuth round trip: the address to send the browser to.
func (s *Service) ConnectURL(ctx context.Context, user, ws uuid.UUID, p domain.Provider) (string, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return "", err
	}
	if !p.Valid() {
		return "", apperr.New(domain.ErrNotConnected, "unknown integration")
	}
	if !s.cal.Configured() {
		return "", apperr.New(domain.ErrNotConfigured, "the server has no Google credentials")
	}
	raw, _ := json.Marshal(statePayload{User: user, WS: ws, P: p, Exp: s.now().Add(stateTTL).Unix()})
	sealed, err := s.sealer.Seal(raw, []byte("integrations.state"))
	if err != nil {
		return "", err
	}
	return s.cal.AuthURL(base64.RawURLEncoding.EncodeToString(sealed), s.RedirectURL(p)), nil
}

// Callback finishes the round trip: it checks the state, stores the sealed refresh token and syncs once.
// It returns the workspace the person connected from.
func (s *Service) Callback(ctx context.Context, provider domain.Provider, state, code string) (uuid.UUID, error) {
	sealed, err := base64.RawURLEncoding.DecodeString(state)
	if err != nil {
		return uuid.Nil, apperr.New(domain.ErrBadState, "bad state")
	}
	raw, err := s.sealer.Open(sealed, []byte("integrations.state"))
	var st statePayload
	if err != nil || json.Unmarshal(raw, &st) != nil || st.P != provider || s.now().Unix() > st.Exp {
		return uuid.Nil, apperr.New(domain.ErrBadState, "bad or expired state")
	}
	token, email, err := s.cal.Exchange(ctx, code, s.RedirectURL(provider))
	if err != nil {
		return st.WS, err
	}
	enc, err := s.sealer.Seal([]byte(token), aad(st.User, provider))
	if err != nil {
		return st.WS, err
	}
	in, err := s.repo.Upsert(ctx, st.User, st.WS, provider, email, enc)
	if err != nil {
		return st.WS, err
	}
	s.sync(ctx, in)
	_ = s.remind(ctx, s.now())
	s.hint(ctx, st.WS, st.User)
	return st.WS, nil
}

// Patch changes how a connection behaves; nil fields stay as they are.
type Patch struct {
	Enabled     *bool
	LeadMinutes *int
	NotifyBell  *bool
	ChannelSet  bool // ChannelID is meaningful (nil clears it)
	ChannelID   *uuid.UUID
}

func (s *Service) Update(ctx context.Context, user, ws uuid.UUID, p domain.Provider, patch Patch) (domain.Integration, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return domain.Integration{}, err
	}
	in, err := s.repo.Get(ctx, user, ws, p)
	if err != nil {
		return domain.Integration{}, err
	}
	var v validation.V
	if patch.Enabled != nil {
		in.Enabled = *patch.Enabled
	}
	if patch.LeadMinutes != nil {
		if !domain.ValidLead(*patch.LeadMinutes) {
			v.Add("leadMinutes", validation.OneOf, map[string]any{"allowed": domain.LeadChoices})
		}
		in.LeadMinutes = *patch.LeadMinutes
	}
	if patch.NotifyBell != nil {
		in.NotifyBell = *patch.NotifyBell
	}
	if patch.ChannelSet {
		in.ChannelID = nil
		if patch.ChannelID != nil {
			chws, err := s.channels.CanPost(ctx, user, *patch.ChannelID)
			if err != nil || chws != ws {
				v.Add("channelId", validation.NotFound, nil)
			} else {
				in.ChannelID = patch.ChannelID
			}
		}
	}
	if err := v.Err(); err != nil {
		return domain.Integration{}, err
	}
	out, err := s.repo.UpdateSettings(ctx, in)
	if err != nil {
		return domain.Integration{}, err
	}
	s.hint(ctx, ws, user)
	return out, nil
}

// Disconnect forgets the account: the sealed token and the cached events go.
func (s *Service) Disconnect(ctx context.Context, user, ws uuid.UUID, p domain.Provider) error {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return err
	}
	if err := s.repo.Delete(ctx, user, ws, p); err != nil {
		return err
	}
	s.hint(ctx, ws, user)
	return nil
}

// SyncNow refreshes one connection on request and sends any reminder that has become due.
func (s *Service) SyncNow(ctx context.Context, user, ws uuid.UUID, p domain.Provider) (domain.Integration, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return domain.Integration{}, err
	}
	in, err := s.repo.Get(ctx, user, ws, p)
	if err != nil {
		return domain.Integration{}, err
	}
	s.sync(ctx, in)
	_ = s.remind(ctx, s.now())
	return s.repo.Get(ctx, user, ws, p)
}

// Upcoming lists the caller's next meetings (all-day events left out), soonest first.
func (s *Service) Upcoming(ctx context.Context, user, ws uuid.UUID, limit int) ([]domain.Event, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	rows, err := s.repo.Upcoming(ctx, user, ws, s.now(), limit*3)
	if err != nil {
		return nil, err
	}
	out := rows[:0]
	for _, e := range rows {
		if !e.AllDay && len(out) < limit {
			out = append(out, e)
		}
	}
	return out, nil
}

// sync pulls the next week of events. A revoked grant marks the connection as needing attention.
func (s *Service) sync(ctx context.Context, in domain.Integration) {
	now := s.now()
	token, err := s.sealer.Open(in.RefreshToken, aad(in.UserID, in.Provider))
	var events []domain.Event
	if err == nil {
		events, err = s.cal.Events(ctx, string(token), now.Add(-lookBehind), now.Add(lookAhead))
	}
	switch {
	case errors.Is(err, domain.ErrReauth):
		_ = s.repo.MarkFailed(ctx, in.ID, domain.Errored, "reconnect")
	case err != nil:
		s.log.Warn("calendar sync failed", slog.String("integration", in.ID.String()), slog.Any("err", err))
		_ = s.repo.MarkFailed(ctx, in.ID, domain.Connected, "sync failed")
	default:
		if err := s.repo.ReplaceEvents(ctx, in.ID, now.Add(-lookBehind), events); err != nil {
			s.log.Warn("calendar store failed", slog.Any("err", err))
			return
		}
		_ = s.repo.MarkSynced(ctx, in.ID)
	}
	s.hint(ctx, in.WorkspaceID, in.UserID)
}

// remind sends the reminder of every meeting that has come within its lead time, once.
func (s *Service) remind(ctx context.Context, now time.Time) error {
	due, err := s.repo.DueReminders(ctx, now)
	if err != nil {
		return err
	}
	for _, d := range due {
		ev, won, err := s.repo.ClaimReminder(ctx, d.EventID)
		if err != nil || !won {
			continue
		}
		in, err := s.repo.ByID(ctx, d.IntegrationID)
		if err != nil {
			continue
		}
		if in.NotifyBell {
			err := s.notices.Notify(ctx, notifdomain.Notification{UserID: in.UserID, WorkspaceID: in.WorkspaceID,
				Kind: notifdomain.Meeting, Title: ev.Title, Body: ev.StartsAt.UTC().Format(time.RFC3339), Link: ev.Open()})
			if err != nil {
				s.log.Warn("meeting notification failed", slog.Any("err", err))
			}
		}
		if in.ChannelID != nil {
			err := s.channels.PostMeeting(ctx, in.WorkspaceID, *in.ChannelID, MeetingPost{Title: ev.Title, StartsAt: ev.StartsAt,
				EndsAt: ev.EndsAt, Location: ev.Location, Link: ev.Open(), LeadMinutes: in.LeadMinutes, Attendees: len(ev.Attendees)})
			if err != nil {
				s.log.Warn("meeting channel post failed", slog.Any("err", err))
			}
		}
		s.hint(ctx, in.WorkspaceID, in.UserID)
	}
	return nil
}

// Tick runs one round of the background loop: refresh stale connections, then send due reminders.
func (s *Service) Tick(ctx context.Context) {
	now := s.now()
	due, err := s.repo.DueForSync(ctx, now.Add(-syncEvery))
	if err != nil {
		s.log.Warn("calendar sync list failed", slog.Any("err", err))
	}
	for _, in := range due {
		s.sync(ctx, in)
	}
	if err := s.remind(ctx, s.now()); err != nil {
		s.log.Warn("meeting reminders failed", slog.Any("err", err))
	}
}

// Run ticks until ctx ends. Several instances may run it: claims are atomic, so each reminder fires once.
func (s *Service) Run(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.Tick(ctx)
		}
	}
}
