package main

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	wikirepo "github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	wikisvc "github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/service"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

// noTeams: the product has no teams yet (docs/adr/0014).
type noTeams struct{}

func (noTeams) TeamsOf(context.Context, uuid.UUID, uuid.UUID) ([]uuid.UUID, error) { return nil, nil }
func (noTeams) Exists(context.Context, uuid.UUID, uuid.UUID) (bool, error)         { return false, nil }

type wikiAuth interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
}

// Space icons are Lucide keys (frontend/src/features/wiki/model/icons.ts), never emoji.

// wikiNode describes a folder or page and its children; Private/Grants set access explicitly.
type wikiNode struct {
	Kind     domain.Kind
	Title    string
	Icon     string
	Private  bool
	Grants   map[string]domain.Role // person key → role
	Children []wikiNode
}

type wikiSpace struct {
	Owner         string
	Name, Icon    string
	Color, Desc   string
	Visibility    domain.Visibility
	WorkspaceRole domain.Role
	Grants        map[string]domain.Role
	Nodes         []wikiNode
}

func page(title string, kids ...wikiNode) wikiNode {
	return wikiNode{Kind: domain.KindPage, Title: title, Children: kids}
}

func folder(title string, kids ...wikiNode) wikiNode {
	return wikiNode{Kind: domain.KindFolder, Title: title, Children: kids}
}

// wikiSeed: runbooks with nested folders, a workspace-wide onboarding space, a shared client
// space (Ukrainian), a private space with a page shared with Peter, a private page inside an
// open space and a shared folder — so every visibility state shows up in the UI.
var wikiSeed = []wikiSpace{
	{
		Owner: "daniel", Name: "Runbooks", Icon: "siren", Color: "red",
		Desc:       "Operational procedures for the on-call rotation: incidents, databases and the network.",
		Visibility: domain.Workspace, WorkspaceRole: domain.RoleEditor,
		Nodes: []wikiNode{
			page("On-call handbook"),
			folder("Incidents",
				page("Incident response checklist"),
				page("Postmortem: API latency, September", page("Timeline"), page("Action items")),
				page("Postmortem: expired TLS certificate"),
			),
			folder("Databases",
				page("PostgreSQL failover"),
				page("Backups and restore drills"),
				folder("Migrations", page("Zero-downtime schema changes"), page("Rollback playbook")),
			),
			folder("Network", page("Edge region cut-over"), page("DNS changes")),
			{Kind: domain.KindFolder, Title: "Security policies", Grants: map[string]domain.Role{"peter": domain.RoleEditor, "michael": domain.RoleViewer},
				Children: []wikiNode{page("Access reviews"), page("MFA rollout")}},
			{Kind: domain.KindPage, Title: "Pager rotation notes (private)", Private: true},
		},
	},
	{
		Owner: "lisa", Name: "Onboarding", Icon: "rocket", Color: "teal",
		Desc:       "Everything a new teammate needs in the first weeks.",
		Visibility: domain.Workspace, WorkspaceRole: domain.RoleViewer,
		Nodes: []wikiNode{
			page("Welcome to Reliabilix"),
			folder("First week", page("Day 1 checklist"), page("Tools and access"), page("Meet the team")),
			folder("Engineering", page("Local development setup"), page("Branching and code review"), page("Release process")),
			page("Glossary"),
		},
	},
	{
		Owner: "peter", Name: "Клієнти", Icon: "handshake", Color: "purple",
		Desc:       "Документація та домовленості з клієнтами.",
		Visibility: domain.Shared, Grants: map[string]domain.Role{"lisa": domain.RoleEditor, "michael": domain.RoleViewer, "olena": domain.RoleCommenter},
		Nodes: []wikiNode{
			folder("Mentia",
				page("Онбординг клієнта"),
				page("Договір і SLA"),
				folder("Зустрічі", page("Зустріч 12 вересня"), page("Зустріч 26 вересня")),
			),
			folder("Reliabilix Labs", page("Огляд інтеграції"), page("Контакти")),
			page("Шаблон комерційної пропозиції"),
		},
	},
	{
		Owner: "peter", Name: "Internal", Icon: "lock", Color: "neutral",
		Desc:       "Leadership notes. Only invited people can see them.",
		Visibility: domain.Private,
		Nodes: []wikiNode{
			page("Hiring plan"),
			page("Salary bands"),
		},
	},
	{
		Owner: "lisa", Name: "Product", Icon: "trending-up", Color: "amber",
		Desc:       "Roadmaps and research (private to the product team).",
		Visibility: domain.Private,
		Nodes: []wikiNode{
			folder("Roadmap", page("Q4 plan"), page("Discovery notes")),
			page("Pricing experiments"),
		},
	},
}

// wikiPeterGuest lists pages of private spaces shared with Peter one by one: they appear under
// "Shared with me" and as detached nodes in the tree.
var wikiPeterGuest = map[string]domain.Role{"Q4 plan": domain.RoleViewer}

func seedWiki(ctx context.Context, pool *pgxpool.Pool, ws wikiAuth, wsID uuid.UUID, ids map[string]uuid.UUID) error {
	svc := wikisvc.New(wikirepo.New(pool), ws, noTeams{})
	var grantNode func(owner, space uuid.UUID, n wikiNode, parent *uuid.UUID) error
	grantNode = func(owner, space uuid.UUID, n wikiNode, parent *uuid.UUID) error {
		v, err := svc.CreateNode(ctx, owner, space, wikisvc.NodeInput{ParentID: parent, Kind: n.Kind, Title: n.Title})
		if err != nil {
			return fmt.Errorf("wiki node %q: %w", n.Title, err)
		}
		target := wikisvc.Target{SpaceID: space, NodeID: &v.Node.ID}
		if n.Private {
			if _, err := svc.SetVisibility(ctx, owner, target, domain.Private, ""); err != nil {
				return err
			}
		}
		if len(n.Grants) > 0 {
			if _, err := svc.SetVisibility(ctx, owner, target, domain.Shared, ""); err != nil {
				return err
			}
		}
		for who, role := range n.Grants {
			if _, err := svc.SetGrant(ctx, owner, target, domain.PrincipalUser, ids[who], role); err != nil {
				return err
			}
		}
		if role, ok := wikiPeterGuest[n.Title]; ok {
			if _, err := svc.SetGrant(ctx, owner, target, domain.PrincipalUser, ids["peter"], role); err != nil {
				return err
			}
		}
		for _, c := range n.Children {
			if err := grantNode(owner, space, c, &v.Node.ID); err != nil {
				return err
			}
		}
		return nil
	}

	for _, s := range wikiSeed {
		owner := ids[s.Owner]
		sv, err := svc.CreateSpace(ctx, owner, wsID, wikisvc.SpaceInput{Name: s.Name, Icon: s.Icon, Color: s.Color,
			Description: s.Desc, Visibility: s.Visibility, WorkspaceRole: s.WorkspaceRole})
		if err != nil {
			return fmt.Errorf("wiki space %q: %w", s.Name, err)
		}
		for who, role := range s.Grants {
			if _, err := svc.SetGrant(ctx, owner, wikisvc.Target{SpaceID: sv.Space.ID}, domain.PrincipalUser, ids[who], role); err != nil {
				return err
			}
		}
		for _, n := range s.Nodes {
			if err := grantNode(owner, sv.Space.ID, n, nil); err != nil {
				return err
			}
		}
	}
	return nil
}
