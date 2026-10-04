// Package repository persists refresh tokens, emailed tokens and OAuth identities.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

// RefreshToken is the persisted state of one refresh token.
type RefreshToken struct {
	ID         uuid.UUID
	UserID     uuid.UUID
	FamilyID   uuid.UUID
	ExpiresAt  time.Time
	RevokedAt  *time.Time
	ReplacedBy *uuid.UUID
}

type NewRefresh struct {
	UserID    uuid.UUID
	FamilyID  uuid.UUID
	Hash      []byte
	ExpiresAt time.Time
	UserAgent string
	IP        string
}

func ptr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (r *Repo) CreateRefresh(ctx context.Context, n NewRefresh) (uuid.UUID, error) {
	return r.q.CreateRefreshToken(ctx, store.CreateRefreshTokenParams{
		UserID: n.UserID, FamilyID: n.FamilyID, TokenHash: n.Hash, ExpiresAt: n.ExpiresAt,
		UserAgent: ptr(truncate(n.UserAgent, 300)), Ip: ptr(n.IP),
	})
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// Rotate locks the token row and calls fn with it inside a transaction. fn may call the
// supplied rotator to atomically issue a replacement in the same family.
func (r *Repo) Rotate(ctx context.Context, hash []byte,
	fn func(cur *RefreshToken, rotate func(NewRefresh) error, revokeFamily func() error) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		row, err := q.GetRefreshTokenForUpdate(ctx, hash)
		var cur *RefreshToken
		if err == nil {
			cur = &RefreshToken{ID: row.ID, UserID: row.UserID, FamilyID: row.FamilyID, ExpiresAt: row.ExpiresAt, RevokedAt: row.RevokedAt}
			if row.ReplacedBy.Valid {
				id := row.ReplacedBy.UUID
				cur.ReplacedBy = &id
			}
		} else if !db.IsNoRows(err) {
			return err
		}
		rotate := func(n NewRefresh) error {
			newID, err := q.CreateRefreshToken(ctx, store.CreateRefreshTokenParams{
				UserID: n.UserID, FamilyID: n.FamilyID, TokenHash: n.Hash, ExpiresAt: n.ExpiresAt,
				UserAgent: ptr(truncate(n.UserAgent, 300)), Ip: ptr(n.IP),
			})
			if err != nil {
				return err
			}
			return q.MarkRefreshTokenRotated(ctx, store.MarkRefreshTokenRotatedParams{
				ID: cur.ID, ReplacedBy: uuid.NullUUID{UUID: newID, Valid: true},
			})
		}
		revoke := func() error { return q.RevokeRefreshFamily(ctx, cur.FamilyID) }
		return fn(cur, rotate, revoke)
	})
}

// FamilyByHash returns the family of a refresh token (any state), or uuid.Nil.
func (r *Repo) FamilyByHash(ctx context.Context, hash []byte) (uuid.UUID, error) {
	var fam uuid.UUID
	err := r.pool.QueryRow(ctx, `SELECT family_id FROM refresh_tokens WHERE token_hash = $1`, hash).Scan(&fam)
	if db.IsNoRows(err) {
		return uuid.Nil, nil
	}
	return fam, err
}

func (r *Repo) RevokeFamily(ctx context.Context, family uuid.UUID) error {
	return r.q.RevokeRefreshFamily(ctx, family)
}

func (r *Repo) RevokeAllForUser(ctx context.Context, userID uuid.UUID) error {
	return r.q.RevokeUserRefreshTokens(ctx, userID)
}

func (r *Repo) RevokeOthersForUser(ctx context.Context, userID, keepFamily uuid.UUID) error {
	return r.q.RevokeOtherUserRefreshTokens(ctx, store.RevokeOtherUserRefreshTokensParams{UserID: userID, KeepFamilyID: keepFamily})
}

func (r *Repo) DeleteExpired(ctx context.Context) error { return r.q.DeleteExpiredRefreshTokens(ctx) }

// IssueUserToken invalidates earlier tokens of the same purpose and stores a new one.
func (r *Repo) IssueUserToken(ctx context.Context, userID uuid.UUID, purpose string, hash []byte, exp time.Time) (uuid.UUID, error) {
	var id uuid.UUID
	err := db.WithTx(ctx, r.pool, func(tx pgx.Tx) error {
		q := r.q.WithTx(tx)
		if err := q.InvalidateUserTokens(ctx, store.InvalidateUserTokensParams{UserID: userID, Purpose: purpose}); err != nil {
			return err
		}
		var err error
		id, err = q.CreateUserToken(ctx, store.CreateUserTokenParams{UserID: userID, Purpose: purpose, TokenHash: hash, ExpiresAt: exp})
		return err
	})
	return id, err
}

// ConsumeUserToken marks a valid token used and returns its owner (uuid.Nil if invalid/expired/used).
func (r *Repo) ConsumeUserToken(ctx context.Context, purpose string, hash []byte) (uuid.UUID, error) {
	id, err := r.q.ConsumeUserToken(ctx, store.ConsumeUserTokenParams{TokenHash: hash, Purpose: purpose})
	if db.IsNoRows(err) {
		return uuid.Nil, nil
	}
	return id, err
}

func (r *Repo) IdentityUser(ctx context.Context, provider, providerUserID string) (uuid.UUID, error) {
	row, err := r.q.GetIdentity(ctx, store.GetIdentityParams{Provider: provider, ProviderUserID: providerUserID})
	if db.IsNoRows(err) {
		return uuid.Nil, nil
	}
	return row.UserID, err
}

func (r *Repo) LinkIdentity(ctx context.Context, userID uuid.UUID, provider, providerUserID, email string) error {
	return r.q.CreateIdentity(ctx, store.CreateIdentityParams{
		UserID: userID, Provider: provider, ProviderUserID: providerUserID, Email: ptr(email),
	})
}

func (r *Repo) ListProviders(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return r.q.ListIdentityProviders(ctx, userID)
}

// SessionRow is one signed-in device.
type SessionRow struct {
	ID         uuid.UUID
	StartedAt  time.Time
	LastSeenAt time.Time
	UserAgent  string
	IP         string
}

func (r *Repo) Sessions(ctx context.Context, userID uuid.UUID) ([]SessionRow, error) {
	rows, err := r.q.ListUserSessions(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]SessionRow, len(rows))
	for i, x := range rows {
		out[i] = SessionRow{ID: x.FamilyID, StartedAt: x.StartedAt, LastSeenAt: x.LastSeenAt, UserAgent: x.UserAgent, IP: x.Ip}
	}
	return out, nil
}

// RevokeUserFamily signs one of the person's devices out; it reports whether there was one.
func (r *Repo) RevokeUserFamily(ctx context.Context, userID, family uuid.UUID) (bool, error) {
	n, err := r.q.RevokeUserRefreshFamily(ctx, store.RevokeUserRefreshFamilyParams{UserID: userID, FamilyID: family})
	return n > 0, err
}
