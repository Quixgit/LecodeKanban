package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/events"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

func (s *Service) sendVerification(ctx context.Context, u usersdomain.User) error {
	raw, err := crypto.NewToken(32)
	if err != nil {
		return err
	}
	id, err := s.repo.IssueUserToken(ctx, u.ID, domain.PurposeVerifyEmail, crypto.HashToken(raw), s.now().Add(s.cfg.VerifyTTL))
	if err != nil {
		return err
	}
	msg, err := verifyEmail(string(u.Locale), u.Email, u.Name, s.cfg.PublicURL+"/verify-email?token="+raw)
	if err != nil {
		return err
	}
	return s.mail(ctx, msg, "verify:"+id.String())
}

// ResendVerification emails a fresh link; no-op when already verified.
func (s *Service) ResendVerification(ctx context.Context, userID uuid.UUID) error {
	u, err := s.users.Get(ctx, userID)
	if err != nil {
		return err
	}
	if u.EmailVerified() {
		return nil
	}
	return s.sendVerification(ctx, u)
}

// VerifyEmail consumes a verification token.
func (s *Service) VerifyEmail(ctx context.Context, rawToken string) error {
	userID, err := s.repo.ConsumeUserToken(ctx, domain.PurposeVerifyEmail, crypto.HashToken(rawToken))
	if err != nil {
		return err
	}
	if userID == uuid.Nil {
		return apperr.New(domain.ErrTokenInvalid, "verification link is invalid or expired")
	}
	u, err := s.users.MarkEmailVerified(ctx, userID)
	if err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.EmailVerified{UserID: u.ID, Email: u.Email})
	return nil
}

// ForgotPassword emails a reset link if the account exists. It never reveals whether it does.
func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	var v validation.V
	v.Email("email", email)
	if err := v.Err(); err != nil {
		return err
	}
	cred, err := s.users.CredentialsByEmail(ctx, email)
	if apperr.IsCode(err, usersdomain.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	raw, err := crypto.NewToken(32)
	if err != nil {
		return err
	}
	id, err := s.repo.IssueUserToken(ctx, cred.User.ID, domain.PurposeResetPassword, crypto.HashToken(raw), s.now().Add(s.cfg.ResetTTL))
	if err != nil {
		return err
	}
	msg, err := resetEmail(string(cred.User.Locale), cred.User.Email, cred.User.Name, s.cfg.PublicURL+"/reset-password?token="+raw)
	if err != nil {
		return err
	}
	return s.mail(ctx, msg, "reset:"+id.String())
}

// ResetPassword sets a new password from an emailed token, unlocks the account,
// marks the email verified (inbox ownership proven) and revokes every session.
func (s *Service) ResetPassword(ctx context.Context, rawToken, password string) error {
	var v validation.V
	v.Password("password", password)
	if err := v.Err(); err != nil {
		return err
	}
	userID, err := s.repo.ConsumeUserToken(ctx, domain.PurposeResetPassword, crypto.HashToken(rawToken))
	if err != nil {
		return err
	}
	if userID == uuid.Nil {
		return apperr.New(domain.ErrTokenInvalid, "reset link is invalid or expired")
	}
	hash, err := crypto.HashPassword(password, s.cfg.Argon)
	if err != nil {
		return err
	}
	if err := s.users.SetPasswordHash(ctx, userID, hash); err != nil {
		return err
	}
	if err := s.users.ResetLoginFailures(ctx, userID); err != nil {
		return err
	}
	if _, err := s.users.MarkEmailVerified(ctx, userID); err != nil {
		return err
	}
	if err := s.repo.RevokeAllForUser(ctx, userID); err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.PasswordChanged{UserID: userID})
	return nil
}
