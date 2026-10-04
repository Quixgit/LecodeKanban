// Package repository maps the users table (via sqlc) to domain types.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct{ q *store.Queries }

func New(dbtx store.DBTX) *Repo { return &Repo{q: store.New(dbtx)} }

func toDomain(u store.User) domain.User {
	return domain.User{
		ID: u.ID, Email: u.Email, Name: u.Name, Locale: domain.Locale(u.Locale),
		AvatarURL: u.AvatarUrl, EmailVerifiedAt: u.EmailVerifiedAt,
		HasPassword: u.PasswordHash != nil, CreatedAt: u.CreatedAt,
		JobTitle: u.JobTitle, Phone: u.Phone, Location: u.Location, Timezone: u.Timezone, Bio: u.Bio,
	}
}

func toCredentials(u store.User) domain.Credentials {
	return domain.Credentials{
		User: toDomain(u), PasswordHash: u.PasswordHash,
		FailedLoginCount: int(u.FailedLoginCount), LockedUntil: u.LockedUntil,
	}
}

func notFound(err error) error {
	if db.IsNoRows(err) {
		return apperr.Wrap(domain.ErrNotFound, "user not found", err)
	}
	return err
}

func (r *Repo) Create(ctx context.Context, in domain.NewUser) (domain.User, error) {
	var verifiedAt *time.Time
	if in.Verified {
		now := time.Now()
		verifiedAt = &now
	}
	u, err := r.q.CreateUser(ctx, store.CreateUserParams{
		Email: in.Email, Name: in.Name, PasswordHash: in.PasswordHash, Locale: string(in.Locale),
		EmailVerifiedAt: verifiedAt, AvatarUrl: in.AvatarURL,
	})
	if db.IsUniqueViolation(err, "users_email_key") {
		return domain.User{}, apperr.Wrap(domain.ErrEmailTaken, "email already registered", err)
	}
	if err != nil {
		return domain.User{}, err
	}
	return toDomain(u), nil
}

func (r *Repo) Get(ctx context.Context, id uuid.UUID) (domain.User, error) {
	u, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toDomain(u), nil
}

func (r *Repo) GetMany(ctx context.Context, ids []uuid.UUID) ([]domain.User, error) {
	rows, err := r.q.GetUsersByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]domain.User, len(rows))
	for i, u := range rows {
		out[i] = toDomain(u)
	}
	return out, nil
}

func (r *Repo) CredentialsByEmail(ctx context.Context, email string) (domain.Credentials, error) {
	u, err := r.q.GetUserByEmail(ctx, email)
	if err != nil {
		return domain.Credentials{}, notFound(err)
	}
	return toCredentials(u), nil
}

func (r *Repo) CredentialsByID(ctx context.Context, id uuid.UUID) (domain.Credentials, error) {
	u, err := r.q.GetUserByID(ctx, id)
	if err != nil {
		return domain.Credentials{}, notFound(err)
	}
	return toCredentials(u), nil
}

func (r *Repo) UpdateProfile(ctx context.Context, id uuid.UUID, p domain.ProfilePatch) (domain.User, error) {
	var locale *string
	if p.Locale != nil {
		s := string(*p.Locale)
		locale = &s
	}
	u, err := r.q.UpdateUserProfile(ctx, store.UpdateUserProfileParams{ID: id, Name: p.Name, Locale: locale,
		JobTitle: p.JobTitle, Phone: p.Phone, Location: p.Location, Timezone: p.Timezone, Bio: p.Bio})
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toDomain(u), nil
}

func (r *Repo) SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	return r.q.SetPasswordHash(ctx, store.SetPasswordHashParams{ID: id, PasswordHash: &hash})
}

func (r *Repo) MarkEmailVerified(ctx context.Context, id uuid.UUID) (domain.User, error) {
	u, err := r.q.MarkEmailVerified(ctx, id)
	if err != nil {
		return domain.User{}, notFound(err)
	}
	return toDomain(u), nil
}

func (r *Repo) RecordLoginFailure(ctx context.Context, id uuid.UUID, threshold int, lock time.Duration) (int, *time.Time, error) {
	row, err := r.q.RecordLoginFailure(ctx, store.RecordLoginFailureParams{
		// Both values are small service constants (5 attempts, 15 min), far below int32 range.
		ID: id, Threshold: int32(threshold), LockSeconds: int32(lock.Seconds()), //nolint:gosec // G115
	})
	return int(row.FailedLoginCount), row.LockedUntil, err
}

func (r *Repo) ResetLoginFailures(ctx context.Context, id uuid.UUID) error {
	return r.q.ResetLoginFailures(ctx, id)
}

func (r *Repo) SetAvatarIfEmpty(ctx context.Context, id uuid.UUID, url string) error {
	return r.q.SetAvatarIfEmpty(ctx, store.SetAvatarIfEmptyParams{ID: id, AvatarUrl: &url})
}

// Avatar returns where an uploaded picture is stored; ok is false when the user has none.
func (r *Repo) Avatar(ctx context.Context, id uuid.UUID) (key, contentType string, ok bool, err error) {
	row, err := r.q.GetAvatar(ctx, id)
	if err != nil {
		return "", "", false, notFound(err)
	}
	if row.AvatarKey == nil || row.AvatarType == nil {
		return "", "", false, nil
	}
	return *row.AvatarKey, *row.AvatarType, true, nil
}

func (r *Repo) SetUploadedAvatar(ctx context.Context, id uuid.UUID, url, key, contentType string) error {
	return r.q.SetUploadedAvatar(ctx, store.SetUploadedAvatarParams{ID: id, AvatarUrl: &url, AvatarKey: &key, AvatarType: &contentType})
}

func (r *Repo) ClearAvatar(ctx context.Context, id uuid.UUID) error { return r.q.ClearAvatar(ctx, id) }
