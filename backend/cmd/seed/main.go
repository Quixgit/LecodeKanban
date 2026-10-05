// Command seed loads demo data (people, workspace, projects, tasks and two weeks of
// history) for local development and demos. It refuses to run in production.
//
//	go run ./cmd/seed [-reset]
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"math/rand/v2"
	"os"
	"time"

	"github.com/google/uuid"

	activityrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/repository"
	activitysvc "github.com/reliabilix/lecodekanban/backend/internal/modules/activity/service"
	boardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/repository"
	boardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/boards/service"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
	commentsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/repository"
	commentssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/comments/service"
	projectdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	projectsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/repository"
	projectssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/service"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	wsrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	wssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/reactions"
)

const (
	emailDomain   = "demo.lecodekanban.test"
	workspaceName = "Acme Studio"
)

func main() {
	reset := flag.Bool("reset", false, "delete previously seeded demo data first")
	flag.Parse()
	if err := run(*reset); err != nil {
		fmt.Fprintln(os.Stderr, "seed:", err)
		os.Exit(1)
	}
}

func run(reset bool) error {
	if os.Getenv("LK_ENV") == "production" {
		return errors.New("refusing to seed a production database")
	}
	url := os.Getenv("LK_DATABASE_URL")
	if url == "" {
		return errors.New("LK_DATABASE_URL is required")
	}
	password := os.Getenv("LK_SEED_PASSWORD")
	if password == "" {
		// Shared password for throwaway demo accounts; seeding is refused in production.
		password = "Demo-Kanban-2026" //nolint:gosec // G101: documented demo credential
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url, 4)
	if err != nil {
		return err
	}
	defer pool.Close()

	var existing int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE email LIKE '%@'||$1`, emailDomain).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 && !reset {
		return fmt.Errorf("demo data already present; run with -reset to recreate it")
	}
	if reset {
		if err := wipe(ctx, pool); err != nil {
			return err
		}
	}

	bus := eventbus.New()
	users := userssvc.New(usersrepo.New(pool), bus)
	ws := wssvc.New(wsrepo.New(pool), users, bus, func(context.Context, mailer.Message, string) error { return nil }, "")
	boards := boardssvc.New(boardsrepo.New(pool), ws, bus)
	projects := projectssvc.New(projectsrepo.New(pool), ws, boards, users, bus)
	cards := cardssvc.New(cardsrepo.New(pool), ws, projects, boards, users, bus)
	projects.SetCardCounter(cards)
	boards.SetCardCounter(cards)
	comments := commentssvc.New(commentsrepo.New(pool), cards, ws, users, bus)
	reactions.Register(bus, reactions.Deps{Projects: projects, Cards: cards,
		Activity: activitysvc.New(activityrepo.New(pool), cards, users), Realtime: silent{}})

	hash, err := crypto.HashPassword(password, crypto.DefaultArgon2)
	if err != nil {
		return err
	}
	ids := map[string]uuid.UUID{}
	for _, p := range people {
		u, err := users.Create(ctx, usersdomain.NewUser{Email: p.Email + "@" + emailDomain, Name: p.Name, PasswordHash: &hash,
			Locale: usersdomain.Locale(p.Locale), Verified: true})
		if err != nil {
			return fmt.Errorf("user %s: %w", p.Email, err)
		}
		ids[p.Email] = u.ID
	}
	owner := ids[people[0].Email]
	w, err := ws.Create(ctx, owner, workspaceName)
	if err != nil {
		return err
	}
	for _, p := range people[1:] {
		if _, err := pool.Exec(ctx, `INSERT INTO workspace_members (workspace_id, user_id, role, joined_at) VALUES ($1,$2,$3, now() - interval '40 days')`,
			w.ID, ids[p.Email], p.Role); err != nil {
			return err
		}
	}

	today := time.Now().UTC().Truncate(24 * time.Hour)
	projectIDs := map[string]uuid.UUID{}
	for _, ps := range projectsSeed {
		in := projectssvc.CreateInput{Name: ps.Name, Key: ps.Key, Description: ps.Description, Status: projectdomain.Status(ps.Status),
			Icon: ps.Icon, Tone: ps.Tone, Team: &ps.Team}
		if pic, ok := ids[ps.PIC]; ok {
			in.PICID = &pic
		}
		start := today.AddDate(0, 0, -45)
		in.StartDate = &start
		if ps.DeadlineDays != 0 {
			d := today.AddDate(0, 0, ps.DeadlineDays)
			in.Deadline = &d
		}
		p, err := projects.Create(ctx, owner, w.ID, in, "en")
		if err != nil {
			return fmt.Errorf("project %s: %w", ps.Name, err)
		}
		projectIDs[ps.Key] = p.ID
	}

	labels, err := seedLabels(ctx, cards, owner, w.ID)
	if err != nil {
		return err
	}
	rng := rand.New(rand.NewPCG(7, 2026)) //nolint:gosec // demo data
	cardIDs := map[string]uuid.UUID{}
	for _, cs := range cardsSeed {
		assignees := make([]uuid.UUID, len(cs.Assignees))
		for i, a := range cs.Assignees {
			assignees[i] = ids[a]
		}
		nc := carddomain.NewCard{ProjectID: projectIDs[cs.Project], Title: cs.Title, Priority: carddomain.Priority(cs.Priority),
			AssigneeIDs: assignees, LabelIDs: labelsFor(cs.Title, labels)}
		if cs.DueDays != 0 {
			d := today.AddDate(0, 0, cs.DueDays)
			nc.DueDate = &d
		}
		actor := assignees[0]
		v, err := cards.Create(ctx, actor, w.ID, nc)
		if err != nil {
			return fmt.Errorf("card %q: %w", cs.Title, err)
		}
		cardIDs[cs.Title] = v.ID
		if err := seedChecklist(ctx, cards, actor, v.ID, cs); err != nil {
			return fmt.Errorf("checklist %q: %w", cs.Title, err)
		}
		if err := walk(ctx, cards, pool, rng, v, carddomain.Status(cs.Status), actor, today); err != nil {
			return fmt.Errorf("card %q: %w", cs.Title, err)
		}
	}
	if err := seedComments(ctx, comments, ids, cardIDs, people); err != nil {
		return err
	}
	if err := seedWiki(ctx, pool, ws, w.ID, ids); err != nil {
		return err
	}
	if err := backdate(ctx, pool); err != nil {
		return err
	}
	for _, id := range projectIDs {
		if err := projects.Recount(ctx, id); err != nil {
			return err
		}
	}

	fmt.Printf("Seeded workspace %q with %d people, %d projects, %d tasks and %d labels.\n",
		workspaceName, len(people), len(projectsSeed), len(cardsSeed), len(labelsSeed))
	fmt.Printf("Sign in as peter@%s (owner) or any other demo user, password: %s\n", emailDomain, password)
	return nil
}

// silent drops realtime hints: nobody is watching while the seed runs.
type silent struct{}

func (silent) Publish(context.Context, realtime.Message) {}
