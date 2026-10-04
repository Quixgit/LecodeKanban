// Package service implements workspace, membership and invitation use cases.
// Every method authorises the caller against the workspace RBAC policy.
package service

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Users is the port onto the users module.
type Users interface {
	Get(ctx context.Context, id uuid.UUID) (usersdomain.User, error)
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
	CredentialsByEmail(ctx context.Context, email string) (usersdomain.Credentials, error)
}

type MailQueue func(ctx context.Context, m mailer.Message, key string) error

type Service struct {
	repo      *repository.Repo
	users     Users
	bus       *eventbus.Bus
	mail      MailQueue
	publicURL string
	inviteTTL time.Duration
	now       func() time.Time
}

func New(repo *repository.Repo, users Users, bus *eventbus.Bus, mail MailQueue, publicURL string) *Service {
	return &Service{repo: repo, users: users, bus: bus, mail: mail, publicURL: publicURL, inviteTTL: 7 * 24 * time.Hour, now: time.Now}
}

var nonSlug = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	base := strings.Trim(nonSlug.ReplaceAllString(strings.ToLower(name), "-"), "-")
	if len(base) > 40 {
		base = strings.TrimRight(base[:40], "-")
	}
	if base == "" {
		base = "workspace"
	}
	b := make([]byte, 4)
	_, _ = rand.Read(b)
	return base + "-" + strings.ToLower(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(b))[:6]
}

func validateName(name string) (string, error) {
	name = strings.TrimSpace(name)
	var v validation.V
	if v.Required("name", name) {
		v.Length("name", name, 1, 80)
	}
	return name, v.Err()
}

// authorize loads the caller's role. Non-members get not_found so workspace existence never leaks.
func (s *Service) authorize(ctx context.Context, r *repository.Repo, ws, user uuid.UUID, perm domain.Permission) (domain.Role, error) {
	role, err := r.Role(ctx, ws, user)
	if err != nil {
		return "", err
	}
	if role == "" {
		return "", apperr.New(domain.ErrNotFound, "workspace not found")
	}
	if !role.Can(perm) {
		return role, apperr.New(domain.ErrInsufficientRole, "insufficient role")
	}
	return role, nil
}

// Authorize is the cross-module RBAC entry point (boards, cards… call it with their permission).
func (s *Service) Authorize(ctx context.Context, ws, user uuid.UUID, perm domain.Permission) (domain.Role, error) {
	return s.authorize(ctx, s.repo, ws, user, perm)
}

// RolesByUser maps every member of a workspace to their role (internal lookup for other modules).
func (s *Service) RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]domain.Role, error) {
	rows, err := s.repo.Members(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make(map[uuid.UUID]domain.Role, len(rows))
	for _, m := range rows {
		out[m.UserID] = m.Role
	}
	return out, nil
}

func (s *Service) create(ctx context.Context, owner uuid.UUID, name string) (domain.Workspace, error) {
	var out domain.Workspace
	for attempt := 0; attempt < 3; attempt++ {
		slug := slugify(name)
		err := s.repo.InTx(ctx, func(r *repository.Repo) error {
			id, created, err := r.Create(ctx, name, slug, owner)
			if err != nil {
				return err
			}
			out = domain.Workspace{ID: id, Name: name, Slug: slug, Role: domain.RoleOwner, MemberCount: 1, CreatedAt: created}
			return r.AddMember(ctx, id, owner, domain.RoleOwner)
		})
		if repository.SlugTaken(err) {
			continue
		}
		return out, err
	}
	return domain.Workspace{}, fmt.Errorf("workspaces: could not allocate a unique slug")
}

// Create makes a new workspace owned by the caller.
func (s *Service) Create(ctx context.Context, user uuid.UUID, name string) (domain.Workspace, error) {
	name, err := validateName(name)
	if err != nil {
		return domain.Workspace{}, err
	}
	return s.create(ctx, user, name)
}

// EnsurePersonal creates "<Name>'s workspace" for users without any membership.
func (s *Service) EnsurePersonal(ctx context.Context, user uuid.UUID) error {
	n, err := s.repo.CountMemberships(ctx, user)
	if err != nil || n > 0 {
		return err
	}
	u, err := s.users.Get(ctx, user)
	if err != nil {
		return err
	}
	first := strings.Fields(u.Name)
	owner := u.Name
	if len(first) > 0 {
		owner = first[0]
	}
	name := fmt.Sprintf("%s's workspace", owner)
	if u.Locale == usersdomain.LocaleUK {
		name = fmt.Sprintf("Простір %s", owner)
	}
	if len([]rune(name)) > 80 {
		name = string([]rune(name)[:80])
	}
	_, err = s.create(ctx, user, name)
	return err
}

// List returns the caller's workspaces, provisioning a personal one on first use.
func (s *Service) List(ctx context.Context, user uuid.UUID) ([]domain.Workspace, error) {
	list, err := s.repo.ListForUser(ctx, user)
	if err != nil || len(list) > 0 {
		return list, err
	}
	if err := s.EnsurePersonal(ctx, user); err != nil {
		return nil, err
	}
	return s.repo.ListForUser(ctx, user)
}

func (s *Service) Get(ctx context.Context, user, ws uuid.UUID) (domain.Workspace, error) {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermView); err != nil {
		return domain.Workspace{}, err
	}
	list, err := s.repo.ListForUser(ctx, user)
	if err != nil {
		return domain.Workspace{}, err
	}
	for _, w := range list {
		if w.ID == ws {
			return w, nil
		}
	}
	return domain.Workspace{}, apperr.New(domain.ErrNotFound, "workspace not found")
}

func (s *Service) Rename(ctx context.Context, user, ws uuid.UUID, name string) (domain.Workspace, error) {
	name, err := validateName(name)
	if err != nil {
		return domain.Workspace{}, err
	}
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermUpdate); err != nil {
		return domain.Workspace{}, err
	}
	if err := s.repo.Rename(ctx, ws, name); err != nil {
		return domain.Workspace{}, err
	}
	return s.Get(ctx, user, ws)
}

func (s *Service) Delete(ctx context.Context, user, ws uuid.UUID) error {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermDelete); err != nil {
		return err
	}
	return s.repo.Delete(ctx, ws)
}

// Members lists members with their profiles.
func (s *Service) Members(ctx context.Context, user, ws uuid.UUID) ([]domain.Member, error) {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermView); err != nil {
		return nil, err
	}
	rows, err := s.repo.Members(ctx, ws)
	if err != nil {
		return nil, err
	}
	ids := make([]uuid.UUID, len(rows))
	for i, m := range rows {
		ids[i] = m.UserID
	}
	profiles, err := s.users.GetMany(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[uuid.UUID]usersdomain.User, len(profiles))
	for _, p := range profiles {
		byID[p.ID] = p
	}
	out := make([]domain.Member, 0, len(rows))
	for _, m := range rows {
		p := byID[m.UserID]
		out = append(out, domain.Member{UserID: m.UserID, Name: p.Name, Email: p.Email, Avatar: p.AvatarURL, Role: m.Role, JoinedAt: m.JoinedAt})
	}
	return out, nil
}

// MemberProfile is the profile card of a teammate: who they are and how to reach them.
type MemberProfile struct {
	User     usersdomain.User
	Role     domain.Role
	JoinedAt time.Time
}

// MemberProfile returns a member's profile to anyone in the same workspace.
func (s *Service) MemberProfile(ctx context.Context, user, ws, target uuid.UUID) (MemberProfile, error) {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermView); err != nil {
		return MemberProfile{}, err
	}
	rows, err := s.repo.Members(ctx, ws)
	if err != nil {
		return MemberProfile{}, err
	}
	for _, m := range rows {
		if m.UserID != target {
			continue
		}
		u, err := s.users.Get(ctx, target)
		if err != nil {
			return MemberProfile{}, err
		}
		return MemberProfile{User: u, Role: m.Role, JoinedAt: m.JoinedAt}, nil
	}
	return MemberProfile{}, apperr.New(domain.ErrMemberNotFound, "member not found")
}

// ChangeRole updates a member's role under the RBAC policy and last-owner protection.
func (s *Service) ChangeRole(ctx context.Context, actor, ws, target uuid.UUID, to domain.Role) error {
	if !to.Valid() {
		var v validation.V
		v.OneOf("role", string(to), "owner", "admin", "member", "viewer")
		return v.Err()
	}
	return s.repo.InTx(ctx, func(r *repository.Repo) error {
		actorRole, err := s.authorize(ctx, r, ws, actor, domain.PermView)
		if err != nil {
			return err
		}
		current, err := r.Role(ctx, ws, target)
		if err != nil {
			return err
		}
		if current == "" {
			return apperr.New(domain.ErrMemberNotFound, "member not found")
		}
		if !domain.CanAssign(actorRole, current, to, actor == target) {
			return apperr.New(domain.ErrInsufficientRole, "insufficient role")
		}
		if current == domain.RoleOwner && to != domain.RoleOwner {
			if err := ensureAnotherOwner(ctx, r, ws); err != nil {
				return err
			}
		}
		return r.SetRole(ctx, ws, target, to)
	})
}

// RemoveMember removes target (or lets the caller leave).
func (s *Service) RemoveMember(ctx context.Context, actor, ws, target uuid.UUID) error {
	err := s.repo.InTx(ctx, func(r *repository.Repo) error {
		actorRole, err := s.authorize(ctx, r, ws, actor, domain.PermView)
		if err != nil {
			return err
		}
		current, err := r.Role(ctx, ws, target)
		if err != nil {
			return err
		}
		if current == "" {
			return apperr.New(domain.ErrMemberNotFound, "member not found")
		}
		if !domain.CanRemove(actorRole, current, actor == target) {
			return apperr.New(domain.ErrInsufficientRole, "insufficient role")
		}
		if current == domain.RoleOwner {
			if err := ensureAnotherOwner(ctx, r, ws); err != nil {
				return err
			}
		}
		return r.RemoveMember(ctx, ws, target)
	})
	if err == nil {
		_ = s.bus.Publish(ctx, events.MemberRemoved{WorkspaceID: ws, UserID: target})
	}
	return err
}

func ensureAnotherOwner(ctx context.Context, r *repository.Repo, ws uuid.UUID) error {
	n, err := r.CountOwners(ctx, ws)
	if err != nil {
		return err
	}
	if n <= 1 {
		return apperr.New(domain.ErrLastOwner, "a workspace needs at least one owner")
	}
	return nil
}
