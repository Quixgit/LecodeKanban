// Package repository persists integrations and their cached calendar events.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/integrations/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
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

func toIntegration(i store.Integration) domain.Integration {
	return domain.Integration{ID: i.ID, UserID: i.UserID, WorkspaceID: i.WorkspaceID, Provider: domain.Provider(i.Provider),
		Enabled: i.Enabled, AccountEmail: i.AccountEmail, RefreshToken: i.RefreshTokenEnc, LeadMinutes: int(i.LeadMinutes),
		NotifyBell: i.NotifyBell, ChannelID: ptrID(i.ChannelID), Status: domain.Status(i.Status), LastError: i.LastError,
		LastSyncAt: i.LastSyncAt}
}

func toEvent(e store.CalendarEvent) domain.Event {
	return domain.Event{ID: e.ID, IntegrationID: e.IntegrationID, RemoteID: e.ProviderEventID, Title: e.Title,
		StartsAt: e.StartsAt, EndsAt: e.EndsAt, AllDay: e.AllDay, Location: e.Location, Link: e.Link, JoinURL: e.JoinUrl,
		Attendees: e.AttendeeEmails, NotifiedAt: e.NotifiedAt}
}

func notFound(err error) error {
	if err == pgx.ErrNoRows {
		return apperr.New(domain.ErrNotConnected, "not connected")
	}
	return err
}

func (r *Repo) Upsert(ctx context.Context, user, ws uuid.UUID, p domain.Provider, email string, token []byte) (domain.Integration, error) {
	row, err := r.q.UpsertIntegration(ctx, store.UpsertIntegrationParams{UserID: user, WorkspaceID: ws, Provider: string(p),
		AccountEmail: email, RefreshTokenEnc: token})
	if err != nil {
		return domain.Integration{}, err
	}
	return toIntegration(row), nil
}

func (r *Repo) Get(ctx context.Context, user, ws uuid.UUID, p domain.Provider) (domain.Integration, error) {
	row, err := r.q.GetIntegration(ctx, store.GetIntegrationParams{UserID: user, WorkspaceID: ws, Provider: string(p)})
	if err != nil {
		return domain.Integration{}, notFound(err)
	}
	return toIntegration(row), nil
}

func (r *Repo) ByID(ctx context.Context, id uuid.UUID) (domain.Integration, error) {
	row, err := r.q.GetIntegrationByID(ctx, id)
	if err != nil {
		return domain.Integration{}, notFound(err)
	}
	return toIntegration(row), nil
}

func (r *Repo) List(ctx context.Context, user, ws uuid.UUID) ([]domain.Integration, error) {
	rows, err := r.q.ListIntegrations(ctx, store.ListIntegrationsParams{UserID: user, WorkspaceID: ws})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Integration, len(rows))
	for i, x := range rows {
		out[i] = toIntegration(x)
	}
	return out, nil
}

func (r *Repo) UpdateSettings(ctx context.Context, i domain.Integration) (domain.Integration, error) {
	row, err := r.q.UpdateIntegrationSettings(ctx, store.UpdateIntegrationSettingsParams{UserID: i.UserID, WorkspaceID: i.WorkspaceID,
		Provider: string(i.Provider), Enabled: i.Enabled, LeadMinutes: int32(i.LeadMinutes), NotifyBell: i.NotifyBell, ChannelID: nullID(i.ChannelID)})
	if err != nil {
		return domain.Integration{}, notFound(err)
	}
	return toIntegration(row), nil
}

func (r *Repo) Delete(ctx context.Context, user, ws uuid.UUID, p domain.Provider) error {
	return r.q.DeleteIntegration(ctx, store.DeleteIntegrationParams{UserID: user, WorkspaceID: ws, Provider: string(p)})
}

func (r *Repo) DueForSync(ctx context.Context, olderThan time.Time) ([]domain.Integration, error) {
	rows, err := r.q.ListDueForSync(ctx, &olderThan)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Integration, len(rows))
	for i, x := range rows {
		out[i] = toIntegration(x)
	}
	return out, nil
}

func (r *Repo) MarkSynced(ctx context.Context, id uuid.UUID) error { return r.q.MarkSynced(ctx, id) }

func (r *Repo) MarkFailed(ctx context.Context, id uuid.UUID, status domain.Status, msg string) error {
	return r.q.MarkSyncFailed(ctx, store.MarkSyncFailedParams{ID: id, Status: string(status), LastError: msg})
}

// ReplaceEvents stores the fetched window and drops cached events that are gone from it.
func (r *Repo) ReplaceEvents(ctx context.Context, integration uuid.UUID, from time.Time, events []domain.Event) error {
	ids := make([]string, 0, len(events))
	for _, e := range events {
		ids = append(ids, e.RemoteID)
		if err := r.q.UpsertEvent(ctx, store.UpsertEventParams{IntegrationID: integration, ProviderEventID: e.RemoteID, Title: e.Title,
			StartsAt: e.StartsAt, EndsAt: e.EndsAt, AllDay: e.AllDay, Location: e.Location, Link: e.Link, JoinUrl: e.JoinURL,
			AttendeeEmails: attendeeList(e.Attendees)}); err != nil {
			return err
		}
	}
	return r.q.DeleteEventsNotIn(ctx, store.DeleteEventsNotInParams{IntegrationID: integration, EndsAt: from, Column3: ids})
}

func (r *Repo) Upcoming(ctx context.Context, user, ws uuid.UUID, now time.Time, limit int) ([]domain.Event, error) {
	rows, err := r.q.ListUpcomingEvents(ctx, store.ListUpcomingEventsParams{UserID: user, WorkspaceID: ws, EndsAt: now, Limit: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Event, len(rows))
	for i, x := range rows {
		out[i] = toEvent(x)
	}
	return out, nil
}

type Due struct{ EventID, IntegrationID uuid.UUID }

func (r *Repo) DueReminders(ctx context.Context, now time.Time) ([]Due, error) {
	rows, err := r.q.ListDueReminders(ctx, now)
	if err != nil {
		return nil, err
	}
	out := make([]Due, len(rows))
	for i, x := range rows {
		out[i] = Due{EventID: x.EventID, IntegrationID: x.IntegrationID}
	}
	return out, nil
}

// ClaimReminder marks the reminder as sent and reports whether this caller won the claim.
func (r *Repo) ClaimReminder(ctx context.Context, event uuid.UUID) (domain.Event, bool, error) {
	row, err := r.q.ClaimReminder(ctx, event)
	if err == pgx.ErrNoRows {
		return domain.Event{}, false, nil
	}
	if err != nil {
		return domain.Event{}, false, err
	}
	return toEvent(row), true, nil
}

func attendeeList(a []string) []string {
	if a == nil {
		return []string{}
	}
	return a
}
