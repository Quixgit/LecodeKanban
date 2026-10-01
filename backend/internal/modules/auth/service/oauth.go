package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/events"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// OAuthLogin signs in with a provider identity:
//  1. a linked identity signs in its user;
//  2. otherwise a verified provider email links to the existing account with that email;
//  3. otherwise a new, already-verified account is created.
//
// Unverified provider emails are never linked to existing accounts (account takeover).
func (s *Service) OAuthLogin(ctx context.Context, p domain.ProviderProfile, locale string, c domain.Client) (domain.Session, error) {
	if p.ID == "" {
		return domain.Session{}, apperr.New(domain.ErrOAuthFailed, "provider returned no user id")
	}
	userID, err := s.repo.IdentityUser(ctx, p.Provider, p.ID)
	if err != nil {
		return domain.Session{}, err
	}
	if userID == uuid.Nil {
		if !p.EmailVerified || p.Email == "" {
			return domain.Session{}, apperr.New(domain.ErrOAuthEmailUnverified, "provider email not verified")
		}
		userID, err = s.linkOrCreate(ctx, p, locale)
		if err != nil {
			return domain.Session{}, err
		}
	}
	if p.AvatarURL != "" {
		_ = s.users.SetAvatarIfEmpty(ctx, userID, p.AvatarURL)
	}
	cred, err := s.users.CredentialsByID(ctx, userID)
	if err != nil {
		return domain.Session{}, err
	}
	if cred.LockedAt(s.now()) {
		return domain.Session{}, s.lockedErr(*cred.LockedUntil)
	}
	return s.newSession(ctx, userID, c)
}

func (s *Service) linkOrCreate(ctx context.Context, p domain.ProviderProfile, locale string) (uuid.UUID, error) {
	cred, err := s.users.CredentialsByEmail(ctx, p.Email)
	switch {
	case err == nil:
		if err := s.repo.LinkIdentity(ctx, cred.User.ID, p.Provider, p.ID, p.Email); err != nil {
			return uuid.Nil, err
		}
		if !cred.User.EmailVerified() {
			if _, err := s.users.MarkEmailVerified(ctx, cred.User.ID); err != nil {
				return uuid.Nil, err
			}
		}
		return cred.User.ID, nil
	case !apperr.IsCode(err, usersdomain.ErrNotFound):
		return uuid.Nil, err
	}

	name := strings.TrimSpace(p.Name)
	if name == "" {
		name = strings.Split(p.Email, "@")[0]
	}
	if len([]rune(name)) > 100 {
		name = string([]rune(name)[:100])
	}
	var avatar *string
	if p.AvatarURL != "" {
		avatar = &p.AvatarURL
	}
	u, err := s.users.Create(ctx, usersdomain.NewUser{
		Email: p.Email, Name: name, Locale: usersdomain.Locale(locale), Verified: true, AvatarURL: avatar,
	})
	if apperr.IsCode(err, usersdomain.ErrEmailTaken) {
		return uuid.Nil, apperr.Wrap(domain.ErrOAuthAccountConflict, "account created concurrently", err)
	}
	if err != nil {
		return uuid.Nil, err
	}
	if err := s.repo.LinkIdentity(ctx, u.ID, p.Provider, p.ID, p.Email); err != nil {
		return uuid.Nil, err
	}
	_ = s.bus.Publish(ctx, events.UserRegistered{UserID: u.ID, Email: u.Email, Name: u.Name, Locale: string(u.Locale), Via: p.Provider})
	return u.ID, nil
}
