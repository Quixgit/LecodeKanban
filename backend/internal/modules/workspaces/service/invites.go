package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Invite emails a join link; re-inviting the same address replaces the open invite.
func (s *Service) Invite(ctx context.Context, actor, ws uuid.UUID, email string, role domain.Role) (domain.Invite, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var v validation.V
	v.Email("email", email)
	v.OneOf("role", string(role), "admin", "member", "viewer")
	if err := v.Err(); err != nil {
		return domain.Invite{}, err
	}
	acc, err := s.authorize(ctx, s.repo, ws, actor, domain.PermView)
	if err != nil {
		return domain.Invite{}, err
	}
	policy, err := s.repo.Settings(ctx, ws)
	if err != nil {
		return domain.Invite{}, err
	}
	if !domain.CanInvite(acc, role) {
		return domain.Invite{}, apperr.New(domain.ErrInsufficientRole, "cannot invite with this role")
	}
	if !policy.EmailAllowed(email) {
		return domain.Invite{}, apperr.New(domain.ErrDomainNotAllowed, "this address is outside the allowed domains")
	}
	if existing, err := s.users.CredentialsByEmail(ctx, email); err == nil {
		if r, err := s.repo.Role(ctx, ws, existing.User.ID); err != nil {
			return domain.Invite{}, err
		} else if r != "" {
			return domain.Invite{}, apperr.New(domain.ErrAlreadyMember, "already a member")
		}
	} else if !apperr.IsCode(err, usersdomain.ErrNotFound) {
		return domain.Invite{}, err
	}

	raw, err := crypto.NewToken(32)
	if err != nil {
		return domain.Invite{}, err
	}
	inv, err := s.repo.ReplaceInvite(ctx, ws, email, role, crypto.HashToken(raw), actor, s.now().Add(time.Duration(policy.InviteDays)*24*time.Hour))
	if err != nil {
		return domain.Invite{}, err
	}
	inviter, err := s.users.Get(ctx, actor)
	if err != nil {
		return domain.Invite{}, err
	}
	wsName, _, _, err := s.repo.Get(ctx, ws)
	if err != nil {
		return domain.Invite{}, err
	}
	msg, err := inviteEmail(string(inviter.Locale), email, inviter.Name, wsName, s.publicURL+"/invite/"+raw)
	if err != nil {
		return domain.Invite{}, err
	}
	if err := s.mail(ctx, msg, "invite:"+inv.ID.String()); err != nil {
		return domain.Invite{}, err
	}
	s.audit(ctx, ws, actor, "invite.sent", map[string]any{"email": email, "role": string(role)})
	return inv, nil
}

func (s *Service) Invites(ctx context.Context, actor, ws uuid.UUID) ([]domain.Invite, error) {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermInvite); err != nil {
		return nil, err
	}
	return s.repo.OpenInvites(ctx, ws)
}

func (s *Service) RevokeInvite(ctx context.Context, actor, ws, inviteID uuid.UUID) error {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermInvite); err != nil {
		return err
	}
	ok, err := s.repo.DeleteInvite(ctx, ws, inviteID)
	if err != nil {
		return err
	}
	if !ok {
		return apperr.New(domain.ErrInviteNotFound, "invite not found")
	}
	s.audit(ctx, ws, actor, "invite.revoked", map[string]any{})
	return nil
}

// Preview shows what an invite link is for (public; the token itself is the secret).
func (s *Service) Preview(ctx context.Context, rawToken string) (domain.InvitePreview, error) {
	inv, err := s.repo.InviteByHash(ctx, crypto.HashToken(rawToken), false)
	if err != nil {
		return domain.InvitePreview{}, err
	}
	name, _, _, err := s.repo.Get(ctx, inv.WorkspaceID)
	if err != nil {
		return domain.InvitePreview{}, err
	}
	p := domain.InvitePreview{
		WorkspaceName: name, Email: inv.Email, Role: inv.Role,
		Expired: !inv.ExpiresAt.After(s.now()), Accepted: inv.AcceptedAt != nil,
	}
	if inv.InvitedBy != nil {
		if u, err := s.users.Get(ctx, *inv.InvitedBy); err == nil {
			p.InviterName = &u.Name
		}
	}
	return p, nil
}

// Accept joins the caller to the workspace. The signed-in email must match the invite.
func (s *Service) Accept(ctx context.Context, user uuid.UUID, rawToken string) (domain.Workspace, error) {
	u, err := s.users.Get(ctx, user)
	if err != nil {
		return domain.Workspace{}, err
	}
	var wsID uuid.UUID
	var role domain.Role
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		inv, err := r.InviteByHash(ctx, crypto.HashToken(rawToken), true)
		if err != nil {
			return err
		}
		switch {
		case inv.AcceptedAt != nil:
			return apperr.New(domain.ErrInviteNotFound, "invite already used")
		case !inv.ExpiresAt.After(s.now()):
			return apperr.New(domain.ErrInviteExpired, "invite expired")
		case !strings.EqualFold(inv.Email, u.Email):
			return apperr.New(domain.ErrInviteMismatch, "invite was sent to a different email")
		}
		existing, err := r.Role(ctx, inv.WorkspaceID, user)
		if err != nil {
			return err
		}
		if existing == "" {
			if err := r.AddMember(ctx, inv.WorkspaceID, user, inv.Role); err != nil {
				return err
			}
		}
		wsID, role = inv.WorkspaceID, inv.Role
		return r.MarkInviteAccepted(ctx, inv.ID)
	})
	if err != nil {
		return domain.Workspace{}, err
	}
	_ = s.bus.Publish(ctx, events.MemberJoined{WorkspaceID: wsID, UserID: user, Role: string(role)})
	return s.Get(ctx, user, wsID)
}
