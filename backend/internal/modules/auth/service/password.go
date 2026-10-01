package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/events"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type RegisterInput struct {
	Name     string
	Email    string
	Password string
	Locale   string
}

// Register creates a password account, signs it in and emails a verification link.
func (s *Service) Register(ctx context.Context, in RegisterInput, c domain.Client) (domain.Session, error) {
	var v validation.V
	name := strings.TrimSpace(in.Name)
	if v.Required("name", name) {
		v.Length("name", name, 1, 100)
	}
	v.Email("email", strings.TrimSpace(in.Email))
	v.Password("password", in.Password)
	if in.Locale != "" {
		v.OneOf("locale", in.Locale, "en", "uk")
	}
	if err := v.Err(); err != nil {
		return domain.Session{}, err
	}

	hash, err := crypto.HashPassword(in.Password, s.cfg.Argon)
	if err != nil {
		return domain.Session{}, err
	}
	u, err := s.users.Create(ctx, usersdomain.NewUser{
		Email: in.Email, Name: name, PasswordHash: &hash, Locale: usersdomain.Locale(in.Locale),
	})
	if err != nil {
		return domain.Session{}, err
	}
	sess, err := s.newSession(ctx, u.ID, c)
	if err != nil {
		return domain.Session{}, err
	}
	if err := s.sendVerification(ctx, u); err != nil {
		return domain.Session{}, err
	}
	_ = s.bus.Publish(ctx, events.UserRegistered{UserID: u.ID, Email: u.Email, Name: u.Name, Locale: string(u.Locale), Via: "password"})
	return sess, nil
}

// Login verifies credentials with lockout after repeated failures.
func (s *Service) Login(ctx context.Context, email, password string, c domain.Client) (domain.Session, error) {
	invalid := apperr.New(domain.ErrInvalidCredentials, "invalid email or password")
	cred, err := s.users.CredentialsByEmail(ctx, email)
	if apperr.IsCode(err, usersdomain.ErrNotFound) {
		_, _ = crypto.VerifyPassword(password, s.dummyHash, s.cfg.Argon)
		return domain.Session{}, invalid
	}
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	if cred.LockedAt(now) {
		return domain.Session{}, s.lockedErr(*cred.LockedUntil)
	}
	if cred.PasswordHash == nil {
		_, _ = crypto.VerifyPassword(password, s.dummyHash, s.cfg.Argon)
		return domain.Session{}, invalid
	}
	rehash, err := crypto.VerifyPassword(password, *cred.PasswordHash, s.cfg.Argon)
	if errors.Is(err, crypto.ErrMismatchedHash) {
		_, lockedUntil, ferr := s.users.RecordLoginFailure(ctx, cred.User.ID, s.cfg.LockThreshold, s.cfg.LockDuration)
		if ferr != nil {
			return domain.Session{}, ferr
		}
		if lockedUntil != nil && lockedUntil.After(now) {
			return domain.Session{}, s.lockedErr(*lockedUntil)
		}
		return domain.Session{}, invalid
	}
	if err != nil {
		return domain.Session{}, err
	}
	if cred.FailedLoginCount > 0 || cred.LockedUntil != nil {
		if err := s.users.ResetLoginFailures(ctx, cred.User.ID); err != nil {
			return domain.Session{}, err
		}
	}
	if rehash {
		if h, err := crypto.HashPassword(password, s.cfg.Argon); err == nil {
			_ = s.users.SetPasswordHash(ctx, cred.User.ID, h)
		}
	}
	return s.newSession(ctx, cred.User.ID, c)
}

func (s *Service) lockedErr(until time.Time) error {
	secs := int(until.Sub(s.now()).Seconds()) + 1
	return apperr.New(domain.ErrAccountLocked, "account temporarily locked").WithMeta("retryAfter", secs)
}

// ChangePassword re-authenticates (when a password exists), sets the new one and
// signs out every other session.
func (s *Service) ChangePassword(ctx context.Context, userID, sessionID uuid.UUID, current *string, next string) error {
	cred, err := s.users.CredentialsByID(ctx, userID)
	if err != nil {
		return err
	}
	if cred.PasswordHash != nil {
		if current == nil || *current == "" {
			return apperr.New(domain.ErrCurrentPassword, "current password required")
		}
		if _, err := crypto.VerifyPassword(*current, *cred.PasswordHash, s.cfg.Argon); err != nil {
			return apperr.New(domain.ErrCurrentPassword, "current password incorrect")
		}
	}
	var v validation.V
	v.Password("newPassword", next)
	if err := v.Err(); err != nil {
		return err
	}
	hash, err := crypto.HashPassword(next, s.cfg.Argon)
	if err != nil {
		return err
	}
	if err := s.users.SetPasswordHash(ctx, userID, hash); err != nil {
		return err
	}
	if err := s.repo.RevokeOthersForUser(ctx, userID, sessionID); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.PasswordChanged{UserID: userID})
	return nil
}
