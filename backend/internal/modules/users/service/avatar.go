package service

import (
	"bytes"
	"context"
	"io"
	"net/http"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/events"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// MaxAvatarBytes is the largest picture accepted (the web client shrinks pictures before sending).
const MaxAvatarBytes = 2 << 20

// Storage keeps picture bytes (the local disk adapter satisfies it).
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, max int64) (int64, error)
	Open(ctx context.Context, key string) (io.ReadSeekCloser, error)
	Delete(ctx context.Context, key string) error
}

// WithAvatars enables profile pictures.
func (s *Service) WithAvatars(st Storage) *Service {
	s.storage = st
	return s
}

// pictureTypes are the formats served back; the type is decided from the bytes, never from the upload.
var pictureTypes = map[string]bool{"image/png": true, "image/jpeg": true, "image/webp": true, "image/gif": true}

// SetAvatar stores a new profile picture, replacing the previous one.
func (s *Service) SetAvatar(ctx context.Context, id uuid.UUID, r io.Reader) (domain.User, error) {
	if s.storage == nil {
		return domain.User{}, apperr.New(domain.ErrBadAvatar, "pictures are not enabled")
	}
	data, err := io.ReadAll(io.LimitReader(r, MaxAvatarBytes+1))
	if err != nil {
		return domain.User{}, err
	}
	if len(data) > MaxAvatarBytes {
		return domain.User{}, apperr.New(domain.ErrAvatarTooLarge, "picture is too large").WithMeta("maxBytes", MaxAvatarBytes)
	}
	kind := http.DetectContentType(data)
	if !pictureTypes[kind] {
		return domain.User{}, apperr.New(domain.ErrBadAvatar, "not a supported picture")
	}
	old, _, had, err := s.repo.Avatar(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	name := uuid.New()
	key := name.String()[:2] + "/" + name.String()
	if _, err := s.storage.Put(ctx, key, bytes.NewReader(data), MaxAvatarBytes); err != nil {
		return domain.User{}, err
	}
	url := "/api/v1/users/" + id.String() + "/avatar?v=" + name.String()[:8]
	if err := s.repo.SetUploadedAvatar(ctx, id, url, key, kind); err != nil {
		_ = s.storage.Delete(ctx, key)
		return domain.User{}, err
	}
	if had {
		_ = s.storage.Delete(ctx, old)
	}
	_ = s.bus.Publish(ctx, events.ProfileUpdated{UserID: id})
	return s.repo.Get(ctx, id)
}

// RemoveAvatar deletes the picture; the person is shown with initials again.
func (s *Service) RemoveAvatar(ctx context.Context, id uuid.UUID) (domain.User, error) {
	old, _, had, err := s.repo.Avatar(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	if err := s.repo.ClearAvatar(ctx, id); err != nil {
		return domain.User{}, err
	}
	if had && s.storage != nil {
		_ = s.storage.Delete(ctx, old)
	}
	_ = s.bus.Publish(ctx, events.ProfileUpdated{UserID: id})
	return s.repo.Get(ctx, id)
}

// OpenAvatar returns the stored picture of a user and its type.
func (s *Service) OpenAvatar(ctx context.Context, id uuid.UUID) (io.ReadSeekCloser, string, error) {
	key, kind, ok, err := s.repo.Avatar(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if !ok || s.storage == nil {
		return nil, "", apperr.New(domain.ErrNotFound, "no picture")
	}
	f, err := s.storage.Open(ctx, key)
	if err != nil {
		return nil, "", apperr.New(domain.ErrNotFound, "no picture")
	}
	return f, kind, nil
}

// MaxCoverBytes is the largest cover picture accepted (the web client shrinks it to about 1600 px wide).
const MaxCoverBytes = 5 << 20

// SetCover stores a new profile cover picture, replacing the previous one and any preset.
func (s *Service) SetCover(ctx context.Context, id uuid.UUID, r io.Reader) (domain.User, error) {
	if s.storage == nil {
		return domain.User{}, apperr.New(domain.ErrBadCover, "pictures are not enabled")
	}
	data, err := io.ReadAll(io.LimitReader(r, MaxCoverBytes+1))
	if err != nil {
		return domain.User{}, err
	}
	if len(data) > MaxCoverBytes {
		return domain.User{}, apperr.New(domain.ErrCoverTooLarge, "picture is too large").WithMeta("maxBytes", MaxCoverBytes)
	}
	kind := http.DetectContentType(data)
	if !pictureTypes[kind] {
		return domain.User{}, apperr.New(domain.ErrBadCover, "not a supported picture")
	}
	old, _, had, err := s.repo.Cover(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	name := uuid.New()
	key := name.String()[:2] + "/" + name.String()
	if _, err := s.storage.Put(ctx, key, bytes.NewReader(data), MaxCoverBytes); err != nil {
		return domain.User{}, err
	}
	url := "/api/v1/users/" + id.String() + "/cover?v=" + name.String()[:8]
	if err := s.repo.SetUploadedCover(ctx, id, url, key, kind); err != nil {
		_ = s.storage.Delete(ctx, key)
		return domain.User{}, err
	}
	if had {
		_ = s.storage.Delete(ctx, old)
	}
	_ = s.bus.Publish(ctx, events.ProfileUpdated{UserID: id})
	return s.repo.Get(ctx, id)
}

// RemoveCover deletes the uploaded cover picture (a preset, if any, is kept).
func (s *Service) RemoveCover(ctx context.Context, id uuid.UUID) (domain.User, error) {
	old, _, had, err := s.repo.Cover(ctx, id)
	if err != nil {
		return domain.User{}, err
	}
	if err := s.repo.ClearCover(ctx, id); err != nil {
		return domain.User{}, err
	}
	if had && s.storage != nil {
		_ = s.storage.Delete(ctx, old)
	}
	_ = s.bus.Publish(ctx, events.ProfileUpdated{UserID: id})
	return s.repo.Get(ctx, id)
}

// OpenCover returns the stored cover picture of a user and its type.
func (s *Service) OpenCover(ctx context.Context, id uuid.UUID) (io.ReadSeekCloser, string, error) {
	key, kind, ok, err := s.repo.Cover(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if !ok || s.storage == nil {
		return nil, "", apperr.New(domain.ErrNotFound, "no picture")
	}
	f, err := s.storage.Open(ctx, key)
	if err != nil {
		return nil, "", apperr.New(domain.ErrNotFound, "no picture")
	}
	return f, kind, nil
}
