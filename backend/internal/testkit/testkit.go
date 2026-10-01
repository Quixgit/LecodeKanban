// Package testkit assembles real module services against a test database, mirroring
// cmd/server/wire.go, so integration tests exercise the same collaboration paths.
package testkit

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	boardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	boardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	cardevents "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/events"
	cardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	projectsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository"
	projectssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	wsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	wssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

type Env struct {
	T          testing.TB
	Bus        *eventbus.Bus
	Users      *userssvc.Service
	Workspaces *wssvc.Service
	Boards     *boardssvc.Service
	Projects   *projectssvc.Service
	Cards      *cardssvc.Service
}

func New(t testing.TB, pool *pgxpool.Pool) *Env {
	bus := eventbus.New()
	users := userssvc.New(usersrepo.New(pool), bus)
	ws := wssvc.New(wsrepo.New(pool), users, bus, func(context.Context, mailer.Message, string) error { return nil }, "http://app.test")
	boards := boardssvc.New(boardsrepo.New(pool), ws)
	projects := projectssvc.New(projectsrepo.New(pool), ws, boards, users, bus)
	cards := cardssvc.New(cardsrepo.New(pool), ws, projects, boards, users, bus)
	projects.SetCardCounter(cards)
	recount := func(ctx context.Context, p uuid.UUID) error { return projects.Recount(ctx, p) }
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardCreated) error { return recount(ctx, e.ProjectID) })
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardMoved) error { return recount(ctx, e.ProjectID) })
	eventbus.Subscribe(bus, func(ctx context.Context, e cardevents.CardDeleted) error { return recount(ctx, e.ProjectID) })
	return &Env{T: t, Bus: bus, Users: users, Workspaces: ws, Boards: boards, Projects: projects, Cards: cards}
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
