package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository/store"
)

// Settings returns the stored settings laid over the defaults.
func (r *Repo) Settings(ctx context.Context, ws uuid.UUID) (domain.Settings, error) {
	s := domain.Defaults()
	data, err := r.q.GetSettings(ctx, ws)
	if errors.Is(err, pgx.ErrNoRows) {
		return s, nil
	}
	if err != nil {
		return s, err
	}
	// Unmarshal over the defaults: keys that were never stored keep their default value.
	if err := json.Unmarshal(data, &s); err != nil {
		return domain.Defaults(), nil
	}
	if s.AllowedDomains == nil {
		s.AllowedDomains = []string{}
	}
	return s, nil
}

func (r *Repo) PutSettings(ctx context.Context, ws uuid.UUID, s domain.Settings) error {
	data, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return r.q.PutSettings(ctx, store.PutSettingsParams{WorkspaceID: ws, Data: data})
}

func (r *Repo) AddAudit(ctx context.Context, ws, actor uuid.UUID, action string, details map[string]any) error {
	data, _ := json.Marshal(details)
	return r.q.AddAudit(ctx, store.AddAuditParams{WorkspaceID: ws, ActorID: uuid.NullUUID{UUID: actor, Valid: actor != uuid.Nil}, Action: action, Details: data})
}

func (r *Repo) Audit(ctx context.Context, ws uuid.UUID, limit int) ([]domain.AuditEntry, error) {
	rows, err := r.q.ListAudit(ctx, store.ListAuditParams{WorkspaceID: ws, Limit: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.AuditEntry, len(rows))
	for i, a := range rows {
		e := domain.AuditEntry{ID: a.ID, Action: a.Action, At: a.At, Details: map[string]any{}}
		if a.ActorID.Valid {
			id := a.ActorID.UUID
			e.ActorID = &id
		}
		_ = json.Unmarshal(a.Details, &e.Details)
		out[i] = e
	}
	return out, nil
}

// MailOverview returns the email queue counts and the latest emails for a workspace's people.
func (r *Repo) MailOverview(ctx context.Context, ws uuid.UUID) (store.MailQueueCountsRow, []store.ListWorkspaceMailRow, error) {
	counts, err := r.q.MailQueueCounts(ctx)
	if err != nil {
		return counts, nil, err
	}
	rows, err := r.q.ListWorkspaceMail(ctx, ws)
	return counts, rows, err
}
