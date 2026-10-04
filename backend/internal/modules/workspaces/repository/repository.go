// Package repository persists workspaces, memberships and invites.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

// InTx runs fn with a repository bound to one transaction.
func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)})
	})
}

// SlugTaken reports a unique-slug collision so callers can retry with another suffix.
func SlugTaken(err error) bool { return db.IsUniqueViolation(err, "workspaces_slug_key") }

func (r *Repo) Create(ctx context.Context, name, slug string, by uuid.UUID) (uuid.UUID, time.Time, error) {
	w, err := r.q.CreateWorkspace(ctx, store.CreateWorkspaceParams{Name: name, Slug: slug, CreatedBy: uuid.NullUUID{UUID: by, Valid: true}})
	return w.ID, w.CreatedAt, err
}

func (r *Repo) AddMember(ctx context.Context, ws, user uuid.UUID, role domain.Role) error {
	return r.q.AddMember(ctx, store.AddMemberParams{WorkspaceID: ws, UserID: user, Role: string(role)})
}

func (r *Repo) ListForUser(ctx context.Context, user uuid.UUID) ([]domain.Workspace, error) {
	rows, err := r.q.ListWorkspacesForUser(ctx, user)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Workspace, len(rows))
	for i, w := range rows {
		out[i] = domain.Workspace{ID: w.ID, Name: w.Name, Slug: w.Slug, Role: domain.Role(w.Role), MemberCount: int(w.MemberCount), CreatedAt: w.CreatedAt}
		acc, err := r.Access(ctx, w.ID, user)
		if err != nil {
			return nil, err
		}
		out[i].Permissions = acc.Permissions()
		if acc.CustomRoleID != nil {
			out[i].CustomRole = &domain.RoleRef{ID: *acc.CustomRoleID, Name: acc.CustomName}
		}
	}
	return out, nil
}

func (r *Repo) CountMemberships(ctx context.Context, user uuid.UUID) (int, error) {
	n, err := r.q.CountMemberships(ctx, user)
	return int(n), err
}

// Role returns the user's role, or ("", nil) when not a member.
func (r *Repo) Role(ctx context.Context, ws, user uuid.UUID) (domain.Role, error) {
	role, err := r.q.GetMemberRole(ctx, store.GetMemberRoleParams{WorkspaceID: ws, UserID: user})
	if db.IsNoRows(err) {
		return "", nil
	}
	return domain.Role(role), err
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (name, slug string, createdAt time.Time, err error) {
	w, err := r.q.GetWorkspace(ctx, id)
	if db.IsNoRows(err) {
		return "", "", time.Time{}, apperr.Wrap(domain.ErrNotFound, "workspace not found", err)
	}
	return w.Name, w.Slug, w.CreatedAt, err
}

func (r *Repo) Rename(ctx context.Context, id uuid.UUID, name string) error {
	_, err := r.q.UpdateWorkspaceName(ctx, store.UpdateWorkspaceNameParams{ID: id, Name: name})
	return err
}

func (r *Repo) Delete(ctx context.Context, id uuid.UUID) error { return r.q.DeleteWorkspace(ctx, id) }

type MemberRow struct {
	UserID     uuid.UUID
	Role       domain.Role
	JoinedAt   time.Time
	CustomRole *domain.RoleRef
}

func (r *Repo) Members(ctx context.Context, ws uuid.UUID) ([]MemberRow, error) {
	rows, err := r.q.ListMembers(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]MemberRow, len(rows))
	for i, m := range rows {
		out[i] = MemberRow{UserID: m.UserID, Role: domain.Role(m.Role), JoinedAt: m.JoinedAt}
		if m.CustomRoleID.Valid && m.CustomName != nil {
			out[i].CustomRole = &domain.RoleRef{ID: m.CustomRoleID.UUID, Name: *m.CustomName}
		}
	}
	return out, nil
}

func (r *Repo) CountOwners(ctx context.Context, ws uuid.UUID) (int, error) {
	n, err := r.q.CountOwners(ctx, ws)
	return int(n), err
}

func (r *Repo) SetRole(ctx context.Context, ws, user uuid.UUID, role domain.Role) error {
	return r.q.UpdateMemberRole(ctx, store.UpdateMemberRoleParams{WorkspaceID: ws, UserID: user, Role: string(role)})
}

func (r *Repo) RemoveMember(ctx context.Context, ws, user uuid.UUID) error {
	return r.q.RemoveMember(ctx, store.RemoveMemberParams{WorkspaceID: ws, UserID: user})
}

func toInvite(i store.WorkspaceInvite) domain.Invite {
	inv := domain.Invite{ID: i.ID, WorkspaceID: i.WorkspaceID, Email: i.Email, Role: domain.Role(i.Role),
		ExpiresAt: i.ExpiresAt, AcceptedAt: i.AcceptedAt, CreatedAt: i.CreatedAt}
	if i.InvitedBy.Valid {
		by := i.InvitedBy.UUID
		inv.InvitedBy = &by
	}
	return inv
}

// ReplaceInvite drops any open invite for the email and creates a new one.
func (r *Repo) ReplaceInvite(ctx context.Context, ws uuid.UUID, email string, role domain.Role, hash []byte, by uuid.UUID, exp time.Time) (domain.Invite, error) {
	if err := r.q.DeleteOpenInviteForEmail(ctx, store.DeleteOpenInviteForEmailParams{WorkspaceID: ws, Email: email}); err != nil {
		return domain.Invite{}, err
	}
	i, err := r.q.CreateInvite(ctx, store.CreateInviteParams{
		WorkspaceID: ws, Email: email, Role: string(role), TokenHash: hash,
		InvitedBy: uuid.NullUUID{UUID: by, Valid: true}, ExpiresAt: exp,
	})
	if err != nil {
		return domain.Invite{}, err
	}
	return toInvite(i), nil
}

func (r *Repo) OpenInvites(ctx context.Context, ws uuid.UUID) ([]domain.Invite, error) {
	rows, err := r.q.ListOpenInvites(ctx, ws)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Invite, len(rows))
	for i, row := range rows {
		out[i] = toInvite(row)
	}
	return out, nil
}

// InviteByHash returns the invite or ErrInviteNotFound. lock selects FOR UPDATE.
func (r *Repo) InviteByHash(ctx context.Context, hash []byte, lock bool) (domain.Invite, error) {
	get := r.q.GetInviteByHash
	if lock {
		get = r.q.GetInviteByHashForUpdate
	}
	i, err := get(ctx, hash)
	if db.IsNoRows(err) {
		return domain.Invite{}, apperr.Wrap(domain.ErrInviteNotFound, "invite not found", err)
	}
	if err != nil {
		return domain.Invite{}, err
	}
	return toInvite(i), nil
}

// DeleteInvite removes an open invite; false when nothing matched.
func (r *Repo) DeleteInvite(ctx context.Context, ws, id uuid.UUID) (bool, error) {
	n, err := r.q.DeleteInvite(ctx, store.DeleteInviteParams{WorkspaceID: ws, ID: id})
	return n > 0, err
}

func (r *Repo) MarkInviteAccepted(ctx context.Context, id uuid.UUID) error {
	return r.q.MarkInviteAccepted(ctx, id)
}
