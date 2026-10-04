// Package testkit assembles real module services against a test database, mirroring
// cmd/server/wire.go, so integration tests exercise the same collaboration paths.
package testkit

import (
	"context"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	activityrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/repository"
	activitysvc "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/service"
	attachrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/repository"
	attachsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/storage/local"
	boardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	boardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	chatrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	chatsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/service"
	commentsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/repository"
	commentssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/service"
	fieldsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/repository"
	fieldssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/customfields/service"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications"
	notifrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/repository"
	notifsvc "github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/service"
	projectsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository"
	projectssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	timerepo "github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/repository"
	timesvc "github.com/reliabilix/lecodekanban/backend/internal/modules/timetracking/service"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	wsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	wssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/reactions"
)

type Env struct {
	T           testing.TB
	Bus         *eventbus.Bus
	Users       *userssvc.Service
	Workspaces  *wssvc.Service
	Boards      *boardssvc.Service
	Projects    *projectssvc.Service
	Cards       *cardssvc.Service
	Comments    *commentssvc.Service
	Fields      *fieldssvc.Service
	Chat        *chatsvc.Service
	Notices     *notifsvc.Service
	Attachments *attachsvc.Service
	Activity    *activitysvc.Service
	Time        *timesvc.Service
	Hints       *Hints
}

// Hints records realtime messages instead of sending them.
type Hints struct {
	mu   sync.Mutex
	msgs []realtime.Message
}

func (h *Hints) Publish(_ context.Context, m realtime.Message) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.msgs = append(h.msgs, m)
}

// Types returns the recorded message types in order and clears the record.
func (h *Hints) Types() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]string, len(h.msgs))
	for i, m := range h.msgs {
		out[i] = m.Type
	}
	h.msgs = nil
	return out
}

// AttachmentMaxBytes is the upload limit used by the test kit.
const AttachmentMaxBytes = 1 << 20

func New(t testing.TB, pool *pgxpool.Pool) *Env {
	bus := eventbus.New()
	users := userssvc.New(usersrepo.New(pool), bus)
	ws := wssvc.New(wsrepo.New(pool), users, bus, func(context.Context, mailer.Message, string) error { return nil }, "http://app.test")
	boards := boardssvc.New(boardsrepo.New(pool), ws, bus)
	projects := projectssvc.New(projectsrepo.New(pool), ws, boards, users, bus)
	cards := cardssvc.New(cardsrepo.New(pool), ws, projects, boards, users, bus)
	projects.SetCardCounter(cards)
	boards.SetCardCounter(cards)
	comments := commentssvc.New(commentsrepo.New(pool), cards, ws, users, bus)
	fields := fieldssvc.New(fieldsrepo.New(pool), cards, ws)
	disk, err := local.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	attachments := attachsvc.New(attachrepo.New(pool), disk, cards, ws, users, bus, AttachmentMaxBytes)
	activity := activitysvc.New(activityrepo.New(pool), cards, users)
	timeTracking := timesvc.New(timerepo.New(pool), cards, ws, users)
	hints := &Hints{}
	chat := chatsvc.New(chatrepo.New(pool), ws, users, hints).WithScopes(projects, cards).WithFiles(disk, AttachmentMaxBytes).WithBus(bus)
	notices := notifsvc.New(notifrepo.New(pool), ws, users, cards, projects, hints)
	notifications.Register(bus, notices, cards)
	reactions.Register(bus, reactions.Deps{Projects: projects, Cards: cards, Activity: activity, Realtime: hints})
	return &Env{T: t, Bus: bus, Users: users, Workspaces: ws, Boards: boards, Projects: projects, Cards: cards,
		Comments: comments, Fields: fields, Chat: chat, Notices: notices, Attachments: attachments, Activity: activity, Time: timeTracking, Hints: hints}
}

// User creates a user.
func (e *Env) User(name, email string) uuid.UUID {
	e.T.Helper()
	u, err := e.Users.Create(context.Background(), usersdomain.NewUser{Email: email, Name: name, Locale: "en"})
	if err != nil {
		e.T.Fatal(err)
	}
	return u.ID
}

// Workspace creates a workspace owned by owner and adds members with roles directly.
func (e *Env) Workspace(owner uuid.UUID, members map[uuid.UUID]wsdomain.Role, pool *pgxpool.Pool) uuid.UUID {
	e.T.Helper()
	ctx := context.Background()
	w, err := e.Workspaces.Create(ctx, owner, "Team")
	if err != nil {
		e.T.Fatal(err)
	}
	for id, role := range members {
		if _, err := pool.Exec(ctx, `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1,$2,$3)`, w.ID, id, string(role)); err != nil {
			e.T.Fatal(err)
		}
	}
	return w.ID
}

// Project creates a project (and its default board) as owner.
func (e *Env) Project(owner, ws uuid.UUID, name string) uuid.UUID {
	e.T.Helper()
	p, err := e.Projects.Create(context.Background(), owner, ws, projectssvc.CreateInput{Name: name}, "en")
	if err != nil {
		e.T.Fatal(err)
	}
	return p.ID
}

// Card creates a to-do card as actor.
func (e *Env) Card(actor, ws, project uuid.UUID, title string) cardssvc.View {
	e.T.Helper()
	v, err := e.Cards.Create(context.Background(), actor, ws, carddomain.NewCard{ProjectID: project, Title: title})
	if err != nil {
		e.T.Fatal(err)
	}
	return v
}
