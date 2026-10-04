// Package service implements user profile use cases.
package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/events"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

// Repository is the persistence port (implemented by repository.Repo).
type Repository interface {
	Create(ctx context.Context, in domain.NewUser) (domain.User, error)
	Get(ctx context.Context, id uuid.UUID) (domain.User, error)
	GetMany(ctx context.Context, ids []uuid.UUID) ([]domain.User, error)
	CredentialsByEmail(ctx context.Context, email string) (domain.Credentials, error)
	CredentialsByID(ctx context.Context, id uuid.UUID) (domain.Credentials, error)
	UpdateProfile(ctx context.Context, id uuid.UUID, p domain.ProfilePatch) (domain.User, error)
	SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error
	MarkEmailVerified(ctx context.Context, id uuid.UUID) (domain.User, error)
	RecordLoginFailure(ctx context.Context, id uuid.UUID, threshold int, lock time.Duration) (int, *time.Time, error)
	ResetLoginFailures(ctx context.Context, id uuid.UUID) error
	SetAvatarIfEmpty(ctx context.Context, id uuid.UUID, url string) error
	Avatar(ctx context.Context, id uuid.UUID) (key, contentType string, ok bool, err error)
	SetUploadedAvatar(ctx context.Context, id uuid.UUID, url, key, contentType string) error
	ClearAvatar(ctx context.Context, id uuid.UUID) error
	Cover(ctx context.Context, id uuid.UUID) (key, contentType string, ok bool, err error)
	SetUploadedCover(ctx context.Context, id uuid.UUID, url, key, contentType string) error
	ClearCover(ctx context.Context, id uuid.UUID) error
}

type Service struct {
	repo    Repository
	bus     *eventbus.Bus
	storage Storage
}

func New(repo Repository, bus *eventbus.Bus) *Service { return &Service{repo: repo, bus: bus} }

// NormalizeEmail lower-cases and trims an address (the column is citext; this keeps output tidy).
func NormalizeEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

func (s *Service) Create(ctx context.Context, in domain.NewUser) (domain.User, error) {
	in.Email = NormalizeEmail(in.Email)
	in.Name = strings.TrimSpace(in.Name)
	if !in.Locale.Valid() {
		in.Locale = domain.LocaleEN
	}
	return s.repo.Create(ctx, in)
}

func (s *Service) Get(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.repo.Get(ctx, id)
}

func (s *Service) GetMany(ctx context.Context, ids []uuid.UUID) ([]domain.User, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	return s.repo.GetMany(ctx, ids)
}

func (s *Service) CredentialsByEmail(ctx context.Context, email string) (domain.Credentials, error) {
	return s.repo.CredentialsByEmail(ctx, NormalizeEmail(email))
}

func (s *Service) CredentialsByID(ctx context.Context, id uuid.UUID) (domain.Credentials, error) {
	return s.repo.CredentialsByID(ctx, id)
}

// UpdateProfile validates and applies a profile patch.
func (s *Service) UpdateProfile(ctx context.Context, id uuid.UUID, p domain.ProfilePatch) (domain.User, error) {
	var v validation.V
	if p.Name != nil {
		trimmed := strings.TrimSpace(*p.Name)
		p.Name = &trimmed
		if v.Required("name", trimmed) {
			v.Length("name", trimmed, 1, 100)
		}
	}
	if p.Locale != nil && !p.Locale.Valid() {
		v.OneOf("locale", string(*p.Locale), string(domain.LocaleEN), string(domain.LocaleUK))
	}
	// The optional details may be cleared (empty string) and are trimmed.
	for _, f := range []struct {
		field string
		val   **string
		max   int
	}{{"jobTitle", &p.JobTitle, 100}, {"phone", &p.Phone, 40}, {"location", &p.Location, 100}, {"bio", &p.Bio, 500}} {
		if *f.val == nil {
			continue
		}
		trimmed := strings.TrimSpace(**f.val)
		*f.val = &trimmed
		v.Length(f.field, trimmed, 0, f.max)
	}
	if p.Timezone != nil {
		tz := strings.TrimSpace(*p.Timezone)
		p.Timezone = &tz
		if _, err := time.LoadLocation(tz); tz != "" && (err != nil || tz == "Local") {
			v.Add("timezone", validation.OneOf, nil)
		}
	}
	checkExtras(&v, &p)
	if err := v.Err(); err != nil {
		return domain.User{}, err
	}
	u, err := s.repo.UpdateProfile(ctx, id, p)
	if err != nil {
		return domain.User{}, err
	}
	if p.CoverPreset != nil && *p.CoverPreset != "" {
		// A chosen preset replaces an uploaded cover picture.
		if u, err = s.RemoveCover(ctx, id); err != nil {
			return domain.User{}, err
		}
	}
	_ = s.bus.Publish(ctx, events.ProfileUpdated{UserID: id})
	return u, nil
}

func (s *Service) SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error {
	return s.repo.SetPasswordHash(ctx, id, hash)
}

func (s *Service) MarkEmailVerified(ctx context.Context, id uuid.UUID) (domain.User, error) {
	return s.repo.MarkEmailVerified(ctx, id)
}

func (s *Service) RecordLoginFailure(ctx context.Context, id uuid.UUID, threshold int, lock time.Duration) (int, *time.Time, error) {
	return s.repo.RecordLoginFailure(ctx, id, threshold, lock)
}

func (s *Service) ResetLoginFailures(ctx context.Context, id uuid.UUID) error {
	return s.repo.ResetLoginFailures(ctx, id)
}

func (s *Service) SetAvatarIfEmpty(ctx context.Context, id uuid.UUID, url string) error {
	return s.repo.SetAvatarIfEmpty(ctx, id, url)
}
