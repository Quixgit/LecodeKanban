// Package repository persists cards, assignees and status transitions.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error { return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)}) })
}

func uuidPtr(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func toDomain(c store.Card) domain.Card {
	return domain.Card{
		ID: c.ID, WorkspaceID: c.WorkspaceID, ProjectID: c.ProjectID, BoardID: c.BoardID, ColumnID: c.ColumnID,
		Number: int(c.Number), Title: c.Title, Description: c.Description, Status: domain.Status(c.Status),
		Priority: domain.Priority(c.Priority), Progress: int(c.Progress), DueDate: c.DueDate, Position: c.Position,
		Version: int(c.Version), CreatedBy: uuidPtr(c.CreatedBy), CompletedAt: c.CompletedAt,
		CreatedAt: c.CreatedAt, UpdatedAt: c.UpdatedAt, ArchivedAt: c.ArchivedAt,
		ChecklistTotal: int(c.ChecklistTotal), ChecklistDone: int(c.ChecklistDone),
		CommentCount: int(c.CommentCount), AttachmentCount: int(c.AttachmentCount),
		ParentID: uuidPtr(c.ParentID), SubtaskTotal: int(c.SubtaskTotal), SubtaskDone: int(c.SubtaskDone),
	}
}

func nullUUID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func notFound(err error) error {
	if db.IsNoRows(err) {
		return apperr.Wrap(domain.ErrNotFound, "card not found", err)
	}
	return err
}

func (r *Repo) NextNumber(ctx context.Context, project uuid.UUID) (int, error) {
	n, err := r.q.NextCardNumber(ctx, project)
	return int(n), err
}

type Insert struct {
	WorkspaceID, ProjectID, BoardID, ColumnID uuid.UUID
	Number                                    int
	Title, Description                        string
	Status                                    domain.Status
	Priority                                  domain.Priority
	Progress                                  int
	DueDate                                   *time.Time
	Position                                  string
	CreatedBy                                 uuid.UUID
	ParentID                                  *uuid.UUID
}

func (r *Repo) Insert(ctx context.Context, in Insert) (domain.Card, error) {
	var completed *time.Time
	if in.Status == domain.Done {
		now := time.Now()
		completed = &now
	}
	c, err := r.q.CreateCard(ctx, store.CreateCardParams{
		WorkspaceID: in.WorkspaceID, ProjectID: in.ProjectID, BoardID: in.BoardID, ColumnID: in.ColumnID,
		Number: int32(in.Number), Title: in.Title, Description: in.Description, Status: string(in.Status), //nolint:gosec // G115: per-project counter
		Priority: string(in.Priority), Progress: int16(in.Progress), DueDate: in.DueDate, Position: in.Position, //nolint:gosec // G115: 0–100
		CreatedBy: uuid.NullUUID{UUID: in.CreatedBy, Valid: true}, CompletedAt: completed,
		ParentID: nullUUID(in.ParentID),
	})
	if err != nil {
		return domain.Card{}, err
	}
	return toDomain(c), nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.Card, error) {
	c, err := r.q.GetCard(ctx, id)
	if err != nil {
		return domain.Card{}, notFound(err)
	}
	return toDomain(c), nil
}

// ByKey finds a card by its project key and number ("PLT", 12) inside a workspace.
func (r *Repo) ByKey(ctx context.Context, ws uuid.UUID, key string, number int) (domain.Card, error) {
	c, err := r.q.GetCardByKey(ctx, store.GetCardByKeyParams{WorkspaceID: ws, Upper: key, Number: int32(number)})
	if err != nil {
		return domain.Card{}, notFound(err)
	}
	return toDomain(c), nil
}

// conflictOrMissing decides why a versioned update matched no row.
func (r *Repo) conflictOrMissing(ctx context.Context, id uuid.UUID) error {
	c, err := r.q.GetCard(ctx, id)
	if err != nil {
		return notFound(err)
	}
	return apperr.New(domain.ErrVersionConflict, "card was changed by someone else").WithMeta("currentVersion", c.Version)
}

func (r *Repo) Update(ctx context.Context, id uuid.UUID, p domain.Patch) (domain.Card, error) {
	params := store.UpdateCardParams{ID: id, Version: int32(p.Version), Title: p.Title, Description: p.Description, //nolint:gosec // G115
		SetDue: p.SetDue, DueDate: p.DueDate}
	if p.Priority != nil {
		s := string(*p.Priority)
		params.Priority = &s
	}
	c, err := r.q.UpdateCard(ctx, params)
	if db.IsNoRows(err) {
		return domain.Card{}, r.conflictOrMissing(ctx, id)
	}
	if err != nil {
		return domain.Card{}, err
	}
	return toDomain(c), nil
}

type MoveTo struct {
	ID, ColumnID, BoardID uuid.UUID
	Status                domain.Status
	Position              string
	Progress              int
	Version               int
}

func (r *Repo) Move(ctx context.Context, m MoveTo) (domain.Card, error) {
	c, err := r.q.MoveCard(ctx, store.MoveCardParams{
		ID: m.ID, ColumnID: m.ColumnID, BoardID: m.BoardID, Status: string(m.Status), Position: m.Position,
		Progress: int16(m.Progress), Version: int32(m.Version), //nolint:gosec // G115: 0–100 / version counter
	})
	if db.IsNoRows(err) {
		return domain.Card{}, r.conflictOrMissing(ctx, m.ID)
	}
	if err != nil {
		return domain.Card{}, err
	}
	return toDomain(c), nil
}

func (r *Repo) Archive(ctx context.Context, id uuid.UUID) (bool, error) {
	n, err := r.q.ArchiveCard(ctx, id)
	return n > 0, err
}

func (r *Repo) LastPosition(ctx context.Context, column uuid.UUID) (string, error) {
	return r.q.LastPosition(ctx, column)
}

// PositionIn returns a card's position if it sits in the column.
func (r *Repo) PositionIn(ctx context.Context, card, column uuid.UUID) (string, bool, error) {
	p, err := r.q.PositionInColumn(ctx, store.PositionInColumnParams{ID: card, ColumnID: column})
	if db.IsNoRows(err) {
		return "", false, nil
	}
	return p, err == nil, err
}

func (r *Repo) NextAfter(ctx context.Context, column uuid.UUID, after string) (string, error) {
	return r.q.NextPositionAfter(ctx, store.NextPositionAfterParams{ColumnID: column, After: after})
}

func (r *Repo) PrevBefore(ctx context.Context, column uuid.UUID, before string) (string, error) {
	return r.q.PrevPositionBefore(ctx, store.PrevPositionBeforeParams{ColumnID: column, Before: before})
}

func (r *Repo) SetAssignees(ctx context.Context, card uuid.UUID, users []uuid.UUID) error {
	if err := r.q.ClearAssignees(ctx, card); err != nil {
		return err
	}
	if len(users) == 0 {
		return nil
	}
	return r.q.AddAssignees(ctx, store.AddAssigneesParams{CardID: card, UserIds: users})
}

func (r *Repo) Assignees(ctx context.Context, cards []uuid.UUID) (map[uuid.UUID][]uuid.UUID, error) {
	out := map[uuid.UUID][]uuid.UUID{}
	if len(cards) == 0 {
		return out, nil
	}
	rows, err := r.q.AssigneesForCards(ctx, cards)
	if err != nil {
		return nil, err
	}
	for _, a := range rows {
		out[a.CardID] = append(out[a.CardID], a.UserID)
	}
	return out, nil
}

func (r *Repo) Transition(ctx context.Context, c domain.Card, from *domain.Status, actor uuid.UUID) error {
	var f *string
	if from != nil {
		s := string(*from)
		f = &s
	}
	return r.q.InsertTransition(ctx, store.InsertTransitionParams{
		CardID: c.ID, WorkspaceID: c.WorkspaceID, ProjectID: c.ProjectID, FromStatus: f, ToStatus: string(c.Status),
		ActorID: uuid.NullUUID{UUID: actor, Valid: actor != uuid.Nil},
	})
}

// CountByProject returns total, completed and average progress of a project's live cards.
func (r *Repo) CountByProject(ctx context.Context, project uuid.UUID) (total, done, progress int, err error) {
	row, err := r.q.CountByProject(ctx, project)
	return int(row.Total), int(row.Done), int(row.AvgProgress), err
}

func (r *Repo) CountInColumn(ctx context.Context, column uuid.UUID) (int, error) {
	n, err := r.q.CountInColumn(ctx, column)
	return int(n), err
}

// PositionInStatus returns a card's position if it is a live card of the status in ws.
func (r *Repo) PositionInStatus(ctx context.Context, card, ws uuid.UUID, st domain.Status) (string, bool, error) {
	p, err := r.q.PositionInStatus(ctx, store.PositionInStatusParams{ID: card, WorkspaceID: ws, Status: string(st)})
	if db.IsNoRows(err) {
		return "", false, nil
	}
	return p, err == nil, err
}

func (r *Repo) NextAfterInStatus(ctx context.Context, ws uuid.UUID, st domain.Status, after string) (string, error) {
	return r.q.NextPositionAfterInStatus(ctx, store.NextPositionAfterInStatusParams{WorkspaceID: ws, Status: string(st), After: after})
}

func (r *Repo) PrevBeforeInStatus(ctx context.Context, ws uuid.UUID, st domain.Status, before string) (string, error) {
	return r.q.PrevPositionBeforeInStatus(ctx, store.PrevPositionBeforeInStatusParams{WorkspaceID: ws, Status: string(st), Before: before})
}

func (r *Repo) LastInStatus(ctx context.Context, ws uuid.UUID, st domain.Status) (string, error) {
	return r.q.LastPositionInStatus(ctx, store.LastPositionInStatusParams{WorkspaceID: ws, Status: string(st)})
}

// RelocateArchived moves archived cards out of a column that is about to be deleted.
func (r *Repo) RelocateArchived(ctx context.Context, from, to uuid.UUID) error {
	return r.q.RelocateArchivedCards(ctx, store.RelocateArchivedCardsParams{FromColumn: from, ToColumn: to})
}

func (r *Repo) SetProgress(ctx context.Context, card uuid.UUID, progress int) error {
	return r.q.SetProgress(ctx, store.SetProgressParams{ID: card, Progress: int16(progress)}) //nolint:gosec // G115: 0–100
}

func (r *Repo) SetCommentCount(ctx context.Context, card uuid.UUID, n int) error {
	return r.q.SetCommentCount(ctx, store.SetCommentCountParams{ID: card, Count: int32(n)}) //nolint:gosec // G115: bounded count
}

func (r *Repo) SetAttachmentCount(ctx context.Context, card uuid.UUID, n int) error {
	return r.q.SetAttachmentCount(ctx, store.SetAttachmentCountParams{ID: card, Count: int32(n)}) //nolint:gosec // G115: bounded count
}
