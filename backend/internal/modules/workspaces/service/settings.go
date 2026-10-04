package service

import (
	"context"
	"slices"

	"github.com/google/uuid"

	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Settings returns the workspace's settings to any member.
func (s *Service) Settings(ctx context.Context, user, ws uuid.UUID) (domain.Settings, error) {
	if _, err := s.authorize(ctx, s.repo, ws, user, domain.PermView); err != nil {
		return domain.Settings{}, err
	}
	return s.repo.Settings(ctx, ws)
}

// Policy returns the settings without checking a person: for other modules that have already
// authorised the caller and only need to know the workspace's rules.
func (s *Service) Policy(ctx context.Context, ws uuid.UUID) (domain.Settings, error) {
	return s.repo.Settings(ctx, ws)
}

// UpdateSettings applies a patch (administrators) and records what changed in the audit log.
func (s *Service) UpdateSettings(ctx context.Context, actor, ws uuid.UUID, p domain.SettingsPatch) (domain.Settings, error) {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermUpdate); err != nil {
		return domain.Settings{}, err
	}
	var out domain.Settings
	err := s.repo.InTx(ctx, func(tx *repository.Repo) error {
		cur, err := tx.Settings(ctx, ws)
		if err != nil {
			return err
		}
		next, bad := cur.Apply(p)
		if len(bad) > 0 {
			var v validation.V
			for _, f := range bad {
				v.Add(f, validation.OneOf, nil)
			}
			return v.Err()
		}
		out = next
		changed := cur.Changes(next)
		if len(changed) == 0 {
			return nil
		}
		if err := tx.PutSettings(ctx, ws, next); err != nil {
			return err
		}
		return tx.AddAudit(ctx, ws, actor, "settings.updated", map[string]any{"changed": changed})
	})
	return out, err
}

// AuditView is an audit entry with the person who did it.
type AuditView struct {
	domain.AuditEntry
	Actor *usersdomain.User
}

// Audit lists the latest administrator actions (administrators only).
func (s *Service) Audit(ctx context.Context, actor, ws uuid.UUID) ([]AuditView, error) {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermUpdate); err != nil {
		return nil, err
	}
	entries, err := s.repo.Audit(ctx, ws, 100)
	if err != nil {
		return nil, err
	}
	ids := []uuid.UUID{}
	for _, e := range entries {
		if e.ActorID != nil && !slices.Contains(ids, *e.ActorID) {
			ids = append(ids, *e.ActorID)
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	out := make([]AuditView, len(entries))
	for i, e := range entries {
		out[i] = AuditView{AuditEntry: e}
		if e.ActorID != nil {
			if u, ok := people[*e.ActorID]; ok {
				out[i].Actor = &u
			}
		}
	}
	return out, nil
}
