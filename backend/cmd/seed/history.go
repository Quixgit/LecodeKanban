package main

import (
	"context"
	"math/rand/v2"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	cardssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/service"
)

var flow = []carddomain.Status{carddomain.Todo, carddomain.InProgress, carddomain.InReview, carddomain.Done}

// walk moves a card through the workflow up to its target status and backdates the
// history over the last two weeks, so the dashboard has realistic activity.
func walk(ctx context.Context, cards *cardssvc.Service, pool *pgxpool.Pool, rng *rand.Rand, v cardssvc.View,
	target carddomain.Status, actor uuid.UUID, today time.Time) error {
	steps := 0
	for i, s := range flow {
		if s == target {
			steps = i
		}
	}
	created := today.AddDate(0, 0, -(steps*2 + rng.IntN(6))).Add(time.Duration(9+rng.IntN(8)) * time.Hour)
	if _, err := pool.Exec(ctx, `UPDATE cards SET created_at = $2 WHERE id = $1`, v.ID, created); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `UPDATE card_transitions SET at = $2 WHERE card_id = $1`, v.ID, created); err != nil {
		return err
	}
	at := created
	version := v.Version
	for i := 1; i <= steps; i++ {
		status := flow[i]
		moved, err := cards.Move(ctx, actor, v.ID, carddomain.Move{Version: version, Status: &status})
		if err != nil {
			return err
		}
		version = moved.Version
		at = at.Add(time.Duration(10+rng.IntN(40)) * time.Hour)
		if at.After(time.Now()) {
			at = time.Now().Add(-time.Duration(rng.IntN(180)) * time.Minute)
		}
		if _, err := pool.Exec(ctx, `UPDATE card_transitions SET at = $3 WHERE card_id = $1 AND to_status = $2`, v.ID, string(status), at); err != nil {
			return err
		}
		if status == carddomain.Done {
			if _, err := pool.Exec(ctx, `UPDATE cards SET completed_at = $2 WHERE id = $1`, v.ID, at); err != nil {
				return err
			}
		}
	}
	return nil
}

func wipe(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		DELETE FROM workspaces w WHERE EXISTS (
			SELECT 1 FROM workspace_members m JOIN users u ON u.id = m.user_id
			WHERE m.workspace_id = w.id AND m.role = 'owner' AND u.email LIKE '%@'||$1);
		`, emailDomain)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `DELETE FROM users WHERE email LIKE '%@'||$1`, emailDomain)
	return err
}

// backdate aligns comments and the activity log with the backdated card history, so feeds read
// like two weeks of real work rather than one burst at seed time.
func backdate(ctx context.Context, pool *pgxpool.Pool) error {
	_, err := pool.Exec(ctx, `
		UPDATE comments SET created_at = now() - make_interval(hours => (random() * 40)::int + 1);
		UPDATE activity a SET at = c.created_at FROM cards c WHERE a.card_id = c.id AND a.kind = 'card.created';
		UPDATE activity a SET at = c.created_at + interval '3 minutes'
			FROM cards c WHERE a.card_id = c.id AND a.kind = 'checklist.added';
		UPDATE activity a SET at = LEAST(now() - interval '30 minutes', c.created_at + make_interval(hours => (random() * 30)::int + 2))
			FROM cards c WHERE a.card_id = c.id AND a.kind = 'checklist.checked';
		UPDATE activity a SET at = t.at FROM card_transitions t
			WHERE a.card_id = t.card_id AND a.kind = 'card.moved' AND t.to_status = a.data->>'to';
		UPDATE activity a SET at = cm.created_at FROM comments cm
			WHERE a.kind = 'comment.created' AND cm.id::text = a.data->>'commentId';
		UPDATE cards c SET updated_at = GREATEST(c.created_at, COALESCE(
			(SELECT max(a.at) FROM activity a WHERE a.card_id = c.id), c.created_at));`)
	return err
}
