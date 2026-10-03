// Package repository persists notifications.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/notifications/repository/store"
)

type Repo struct{ q *store.Queries }

func New(pool *pgxpool.Pool) *Repo { return &Repo{q: store.New(pool)} }

func nullID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func ptrID(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func toDomain(n store.Notification) domain.Notification {
	return domain.Notification{ID: n.ID, UserID: n.UserID, WorkspaceID: n.WorkspaceID, Kind: domain.Kind(n.Kind),
		ActorID: ptrID(n.ActorID), CardID: ptrID(n.CardID), ProjectID: ptrID(n.ProjectID), ChannelID: ptrID(n.ChannelID),
		MessageID: ptrID(n.MessageID), Title: n.Title, Body: n.Body, CreatedAt: n.CreatedAt, ReadAt: n.ReadAt}
}

func (r *Repo) Insert(ctx context.Context, n domain.Notification) (domain.Notification, error) {
	row, err := r.q.InsertNotification(ctx, store.InsertNotificationParams{UserID: n.UserID, WorkspaceID: n.WorkspaceID,
		Kind: string(n.Kind), ActorID: nullID(n.ActorID), CardID: nullID(n.CardID), ProjectID: nullID(n.ProjectID),
		ChannelID: nullID(n.ChannelID), MessageID: nullID(n.MessageID), Title: n.Title, Body: n.Body})
	if err != nil {
		return domain.Notification{}, err
	}
	return toDomain(row), nil
}

// List returns a person's notifications in a workspace, newest first, older than before when set.
func (r *Repo) List(ctx context.Context, user, ws uuid.UUID, before *time.Time, limit int) ([]domain.Notification, error) {
	rows, err := r.q.ListNotifications(ctx, store.ListNotificationsParams{UserID: user, WorkspaceID: ws, Before: before, Limit: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Notification, len(rows))
	for i, n := range rows {
		out[i] = toDomain(n)
	}
	return out, nil
}

func (r *Repo) Unread(ctx context.Context, user, ws uuid.UUID) (int, error) {
	n, err := r.q.CountUnreadNotifications(ctx, store.CountUnreadNotificationsParams{UserID: user, WorkspaceID: ws})
	return int(n), err
}

func (r *Repo) MarkRead(ctx context.Context, user, ws uuid.UUID, ids []uuid.UUID) error {
	return r.q.MarkNotificationsRead(ctx, store.MarkNotificationsReadParams{UserID: user, WorkspaceID: ws, Column3: ids})
}

func (r *Repo) MarkAllRead(ctx context.Context, user, ws uuid.UUID) error {
	return r.q.MarkAllNotificationsRead(ctx, store.MarkAllNotificationsReadParams{UserID: user, WorkspaceID: ws})
}
