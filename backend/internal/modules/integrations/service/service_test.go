package service_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	chatservice "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
	"github.com/reliabilix/lecodekanban/backend/internal/testkit"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

// fakeCalendar stands in for Google: it hands out a refresh token and serves a list of events.
type fakeCalendar struct {
	configured bool
	events     []domain.Event
	err        error
	lastToken  string
}

func (f *fakeCalendar) Configured() bool { return f.configured }
func (f *fakeCalendar) AuthURL(state, redirect string) string {
	return "https://accounts.test/auth?state=" + state + "&redirect=" + redirect
}
func (f *fakeCalendar) Exchange(_ context.Context, code, _ string) (string, string, error) {
	return "refresh-" + code, "anna@gmail.test", nil
}
func (f *fakeCalendar) Events(_ context.Context, token string, _, _ time.Time) ([]domain.Event, error) {
	f.lastToken = token
	return f.events, f.err
}

type chatAdapter struct{ chat *chatservice.Service }

func (c chatAdapter) CanPost(ctx context.Context, user, channel uuid.UUID) (uuid.UUID, error) {
	return c.chat.CanPost(ctx, user, channel)
}
func (c chatAdapter) PostMeeting(ctx context.Context, ws, channel uuid.UUID, m service.MeetingPost) error {
	return c.chat.PostMeeting(ctx, ws, channel, chatservice.MeetingNotice{Title: m.Title, StartsAt: m.StartsAt, EndsAt: m.EndsAt,
		Location: m.Location, Link: m.Link, LeadMinutes: m.LeadMinutes, Attendees: m.Attendees})
}

type world struct {
	e                     *testkit.Env
	svc                   *service.Service
	cal                   *fakeCalendar
	now                   time.Time
	ws                    uuid.UUID
	owner, anna, outsider uuid.UUID
	otherWS               uuid.UUID
}

func setup(t *testing.T) *world {
	tdb.Reset(t)
	e := testkit.New(t, tdb.Pool)
	w := &world{e: e, cal: &fakeCalendar{configured: true}, now: time.Date(2026, 10, 5, 9, 0, 0, 0, time.UTC)}
	w.owner = e.User("Olena Owner", "o@example.com")
	w.anna = e.User("Anna Member", "a@example.com")
	w.outsider = e.User("Out Sider", "x@example.com")
	w.ws = e.Workspace(w.owner, map[uuid.UUID]wsdomain.Role{w.anna: wsdomain.RoleMember}, tdb.Pool)
	w.otherWS = e.Workspace(w.outsider, nil, tdb.Pool)
	key := make([]byte, 32)
	sealer, err := crypto.NewSealer(key)
	if err != nil {
		t.Fatal(err)
	}
	w.svc = service.New(repository.New(tdb.Pool), e.Workspaces, w.cal, sealer, e.Notices, chatAdapter{e.Chat}, e.Hints,
		"http://app.test", slog.New(slog.NewTextHandler(io.Discard, nil))).WithClock(func() time.Time { return w.now })
	return w
}

func (w *world) connect(t *testing.T) domain.Integration {
	t.Helper()
	ctx := context.Background()
	u, err := w.svc.ConnectURL(ctx, w.anna, w.ws, domain.GoogleCalendar)
	if err != nil {
		t.Fatal(err)
	}
	state := u[strings.Index(u, "state=")+6 : strings.Index(u, "&redirect")]
	if _, err := w.svc.Callback(ctx, domain.GoogleCalendar, state, "code1"); err != nil {
		t.Fatal(err)
	}
	list, _ := w.svc.Catalog(ctx, w.anna, w.ws)
	return *list[0].Integration
}

func (w *world) meeting(id, title string, in time.Duration) domain.Event {
	return domain.Event{RemoteID: id, Title: title, StartsAt: w.now.Add(in), EndsAt: w.now.Add(in + time.Hour),
		JoinURL: "https://meet.test/" + id, Link: "https://calendar.test/" + id, Attendees: []string{"o@example.com", "a@example.com"}}
}

func bell(t *testing.T, w *world) []string {
	t.Helper()
	p, err := w.e.Notices.List(context.Background(), w.anna, w.ws, nil, 50)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, n := range p.Items {
		if string(n.Kind) == "meeting" {
			out = append(out, n.Title+"|"+n.Link)
		}
	}
	return out
}

func TestConnectFlow(t *testing.T) {
	w := setup(t)
	ctx := context.Background()

	w.cal.configured = false
	_, err := w.svc.ConnectURL(ctx, w.anna, w.ws, domain.GoogleCalendar)
	if !apperr.IsCode(err, domain.ErrNotConfigured) {
		t.Fatalf("unconfigured: %v", err)
	}
	cat, _ := w.svc.Catalog(ctx, w.anna, w.ws)
	if cat[0].Configured || cat[0].Integration != nil {
		t.Fatalf("catalog: %+v", cat[0])
	}
	w.cal.configured = true

	// A forged or expired state is refused.
	if _, err := w.svc.Callback(ctx, domain.GoogleCalendar, "garbage", "c"); !apperr.IsCode(err, domain.ErrBadState) {
		t.Fatalf("garbage state: %v", err)
	}
	u, _ := w.svc.ConnectURL(ctx, w.anna, w.ws, domain.GoogleCalendar)
	state := u[strings.Index(u, "state=")+6 : strings.Index(u, "&redirect")]
	w.now = w.now.Add(11 * time.Minute)
	if _, err := w.svc.Callback(ctx, domain.GoogleCalendar, state, "c"); !apperr.IsCode(err, domain.ErrBadState) {
		t.Fatalf("expired state: %v", err)
	}
	w.now = w.now.Add(-11 * time.Minute)

	w.cal.events = []domain.Event{w.meeting("e1", "Stand-up", 3*time.Hour)}
	in := w.connect(t)
	if !in.Enabled || in.AccountEmail != "anna@gmail.test" || in.LeadMinutes != 30 || in.Status != domain.Connected {
		t.Fatalf("integration: %+v", in)
	}
	if string(in.RefreshToken) == "refresh-code1" || len(in.RefreshToken) == 0 {
		t.Fatal("the refresh token must be stored sealed")
	}
	if w.cal.lastToken != "refresh-code1" {
		t.Fatalf("sync used token %q", w.cal.lastToken)
	}
	up, err := w.svc.Upcoming(ctx, w.anna, w.ws, 5)
	if err != nil || len(up) != 1 || up[0].Title != "Stand-up" || up[0].Open() != "https://meet.test/e1" {
		t.Fatalf("upcoming: %+v %v", up, err)
	}

	// Others cannot see it, and strangers cannot reach the workspace's catalogue.
	if up, _ := w.svc.Upcoming(ctx, w.owner, w.ws, 5); len(up) != 0 {
		t.Fatalf("owner sees anna's meetings: %+v", up)
	}
	if _, err := w.svc.Catalog(ctx, w.outsider, w.ws); err == nil {
		t.Fatal("outsider read the catalogue")
	}
}

func TestMeetingReminders(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	general, err := w.e.Chat.CreateChannel(ctx, w.anna, w.ws, chatservice.ChannelInput{Name: "general"})
	if err != nil {
		t.Fatal(err)
	}
	w.cal.events = []domain.Event{w.meeting("soon", "Stand-up", 20*time.Minute), w.meeting("later", "Planning", 2*time.Hour),
		{RemoteID: "allday", Title: "Holiday", StartsAt: w.now, EndsAt: w.now.Add(24 * time.Hour), AllDay: true}}
	w.connect(t)
	if _, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{ChannelSet: true, ChannelID: &general.ID}); err != nil {
		t.Fatal(err)
	}

	// Connecting inside the lead window rings at once, for that meeting only, and exactly once.
	if got := bell(t, w); len(got) != 1 || got[0] != "Stand-up|https://meet.test/soon" {
		t.Fatalf("bell after connect: %v", got)
	}
	w.svc.Tick(ctx)
	w.svc.Tick(ctx)
	if got := bell(t, w); len(got) != 1 {
		t.Fatalf("reminder repeated: %v", got)
	}

	// The next meeting rings when its lead time begins, and now also posts to the channel.
	w.now = w.now.Add(time.Hour + 31*time.Minute)
	w.svc.Tick(ctx)
	if got := bell(t, w); len(got) != 2 {
		t.Fatalf("bell after the lead time: %v", got)
	}
	page, err := w.e.Chat.Messages(ctx, w.anna, general.ID, nil, 20)
	if err != nil || len(page.Messages) != 1 {
		t.Fatalf("channel messages: %+v %v", page.Messages, err)
	}
	var ev struct {
		Kind, Title, Link string
		LeadMinutes       int
	}
	if json.Unmarshal(page.Messages[0].Event, &ev) != nil || ev.Kind != "meeting" || ev.Title != "Planning" ||
		ev.Link != "https://meet.test/later" || ev.LeadMinutes != 30 || page.Messages[0].Author != nil {
		t.Fatalf("meeting message: %s", page.Messages[0].Event)
	}

	// A meeting moved to later is announced again; a paused connection is silent; the bell can be off.
	w.cal.events = []domain.Event{w.meeting("later", "Planning", 3*time.Hour), w.meeting("x", "Retro", 10*time.Minute)}
	off := false
	if _, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{Enabled: &off}); err != nil {
		t.Fatal(err)
	}
	w.now = w.now.Add(6 * time.Minute)
	w.svc.Tick(ctx)
	if got := bell(t, w); len(got) != 2 {
		t.Fatalf("paused connection rang: %v", got)
	}
	on, noBell := true, false
	if _, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{Enabled: &on, NotifyBell: &noBell}); err != nil {
		t.Fatal(err)
	}
	if _, err := w.svc.SyncNow(ctx, w.anna, w.ws, domain.GoogleCalendar); err != nil {
		t.Fatal(err)
	}
	if got := bell(t, w); len(got) != 2 {
		t.Fatalf("bell switched off but rang: %v", got)
	}
	if up, _ := w.svc.Upcoming(ctx, w.anna, w.ws, 5); len(up) != 2 || up[0].Title != "Retro" {
		t.Fatalf("upcoming after changes: %+v", up)
	}
}

func TestSettingsAndDisconnect(t *testing.T) {
	w := setup(t)
	ctx := context.Background()
	w.cal.events = []domain.Event{w.meeting("e1", "Stand-up", 3*time.Hour)}
	w.connect(t)

	bad := 7
	if _, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{LeadMinutes: &bad}); !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("lead 7: %v", err)
	}
	good := 10
	got, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{LeadMinutes: &good})
	if err != nil || got.LeadMinutes != 10 {
		t.Fatalf("lead 10: %+v %v", got, err)
	}
	// A channel the person cannot write in, or from another workspace, is refused.
	foreign, _ := w.e.Chat.CreateChannel(ctx, w.outsider, w.otherWS, chatservice.ChannelInput{Name: "elsewhere"})
	if _, err := w.svc.Update(ctx, w.anna, w.ws, domain.GoogleCalendar, service.Patch{ChannelSet: true, ChannelID: &foreign.ID}); !apperr.IsCode(err, apperr.Validation) {
		t.Fatalf("foreign channel: %v", err)
	}

	// A revoked grant marks the connection as needing attention instead of failing silently.
	w.cal.err = domain.ErrReauth
	got2, err := w.svc.SyncNow(ctx, w.anna, w.ws, domain.GoogleCalendar)
	if err != nil || got2.Status != domain.Errored {
		t.Fatalf("after revoke: %+v %v", got2, err)
	}
	// Connecting again heals it.
	w.cal.err = nil
	if in := w.connect(t); in.Status != domain.Connected {
		t.Fatalf("reconnect: %+v", in)
	}

	if err := w.svc.Disconnect(ctx, w.anna, w.ws, domain.GoogleCalendar); err != nil {
		t.Fatal(err)
	}
	cat, _ := w.svc.Catalog(ctx, w.anna, w.ws)
	if cat[0].Integration != nil {
		t.Fatal("still connected")
	}
	if up, _ := w.svc.Upcoming(ctx, w.anna, w.ws, 5); len(up) != 0 {
		t.Fatalf("events outlived the connection: %+v", up)
	}
	if _, err := w.svc.SyncNow(ctx, w.anna, w.ws, domain.GoogleCalendar); !apperr.IsCode(err, domain.ErrNotConnected) {
		t.Fatalf("sync after disconnect: %v", err)
	}
}
