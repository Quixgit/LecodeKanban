package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/totp"
)

const (
	mfaScope       = "mfa"
	mfaTTL         = 5 * time.Minute
	recoveryCodes  = 8
	issuerName     = "LecodeKanban"
	recoveryLength = 10 // characters, shown as xxxxx-xxxxx
)

// TwoFactorStatus is what the security page shows.
type TwoFactorStatus struct {
	Enabled           bool
	RecoveryRemaining int
}

// TwoFactorSetup is a freshly generated, not yet confirmed secret.
type TwoFactorSetup struct {
	Secret string
	URI    string
}

func (s *Service) seal(userID uuid.UUID, secret string) ([]byte, error) {
	return s.sealer.Seal([]byte(secret), userID[:])
}

func (s *Service) secretOf(userID uuid.UUID, sealed []byte) (string, error) {
	b, err := s.sealer.Open(sealed, userID[:])
	return string(b), err
}

func badCode() error {
	return apperr.New(domain.ErrTwoFactorCode, "that code is not valid")
}

func recoveryHash(code string) []byte {
	return crypto.HashToken(strings.ToLower(strings.ReplaceAll(strings.TrimSpace(code), "-", "")))
}

func newRecoveryCodes() (plain []string, hashes [][]byte, err error) {
	for i := 0; i < recoveryCodes; i++ {
		raw, err := crypto.NewToken(16)
		if err != nil {
			return nil, nil, err
		}
		// Letters and digits that cannot be confused when read aloud or typed.
		var b strings.Builder
		for _, r := range strings.ToLower(raw) {
			if strings.ContainsRune("abcdefghjkmnpqrstuvwxyz23456789", r) {
				b.WriteRune(r)
			}
			if b.Len() == recoveryLength {
				break
			}
		}
		if b.Len() < recoveryLength {
			i--
			continue
		}
		c := b.String()
		plain = append(plain, c[:5]+"-"+c[5:])
		hashes = append(hashes, recoveryHash(c))
	}
	return plain, hashes, nil
}

// TwoFactorStatus reports whether the second factor is on.
func (s *Service) TwoFactorStatus(ctx context.Context, userID uuid.UUID) (TwoFactorStatus, error) {
	t, err := s.repo.TwoFactor(ctx, userID)
	if err != nil || t == nil || !t.Enabled {
		return TwoFactorStatus{}, err
	}
	return TwoFactorStatus{Enabled: true, RecoveryRemaining: len(t.Recovery)}, nil
}

// SetupTwoFactor generates a secret to scan. It stays inactive until EnableTwoFactor confirms a code.
func (s *Service) SetupTwoFactor(ctx context.Context, userID uuid.UUID) (TwoFactorSetup, error) {
	u, err := s.users.Get(ctx, userID)
	if err != nil {
		return TwoFactorSetup{}, err
	}
	secret, err := totp.NewSecret()
	if err != nil {
		return TwoFactorSetup{}, err
	}
	sealed, err := s.seal(userID, secret)
	if err != nil {
		return TwoFactorSetup{}, err
	}
	ok, err := s.repo.StartTwoFactor(ctx, userID, sealed)
	if err != nil {
		return TwoFactorSetup{}, err
	}
	if !ok {
		return TwoFactorSetup{}, apperr.New(domain.ErrTwoFactorState, "two-factor authentication is already on")
	}
	return TwoFactorSetup{Secret: secret, URI: totp.URI(issuerName, u.Email, secret)}, nil
}

// EnableTwoFactor confirms the first code and returns the one-time recovery codes (shown once).
func (s *Service) EnableTwoFactor(ctx context.Context, userID uuid.UUID, code string) ([]string, error) {
	t, err := s.repo.TwoFactor(ctx, userID)
	if err != nil {
		return nil, err
	}
	if t == nil || t.Enabled {
		return nil, apperr.New(domain.ErrTwoFactorState, "start the setup first")
	}
	secret, err := s.secretOf(userID, t.Secret)
	if err != nil {
		return nil, err
	}
	step, ok := totp.Verify(secret, code, s.now())
	if !ok {
		return nil, badCode()
	}
	plain, hashes, err := newRecoveryCodes()
	if err != nil {
		return nil, err
	}
	if ok, err := s.repo.EnableTwoFactor(ctx, userID, step, hashes); err != nil || !ok {
		if err == nil {
			err = apperr.New(domain.ErrTwoFactorState, "two-factor authentication is already on")
		}
		return nil, err
	}
	return plain, nil
}

// checkSecondFactor accepts a current authenticator code (once) or an unused recovery code.
func (s *Service) checkSecondFactor(ctx context.Context, userID uuid.UUID, code string) error {
	t, err := s.repo.TwoFactor(ctx, userID)
	if err != nil {
		return err
	}
	if t == nil || !t.Enabled {
		return apperr.New(domain.ErrTwoFactorState, "two-factor authentication is off")
	}
	secret, err := s.secretOf(userID, t.Secret)
	if err != nil {
		return err
	}
	if step, ok := totp.Verify(secret, code, s.now()); ok {
		fresh, err := s.repo.AcceptStep(ctx, userID, step)
		if err != nil {
			return err
		}
		if !fresh {
			return badCode() // the same code twice
		}
		return nil
	}
	if used, err := s.repo.UseRecovery(ctx, userID, recoveryHash(code)); err != nil {
		return err
	} else if used {
		return nil
	}
	return badCode()
}

// DisableTwoFactor turns the factor off; it needs the password (when there is one) and a code.
func (s *Service) DisableTwoFactor(ctx context.Context, userID uuid.UUID, password *string, code string) error {
	if err := s.reauthenticate(ctx, userID, password); err != nil {
		return err
	}
	if err := s.checkSecondFactor(ctx, userID, code); err != nil {
		return err
	}
	return s.repo.DisableTwoFactor(ctx, userID)
}

// RegenerateRecoveryCodes replaces the recovery codes after a valid code.
func (s *Service) RegenerateRecoveryCodes(ctx context.Context, userID uuid.UUID, code string) ([]string, error) {
	if err := s.checkSecondFactor(ctx, userID, code); err != nil {
		return nil, err
	}
	plain, hashes, err := newRecoveryCodes()
	if err != nil {
		return nil, err
	}
	return plain, s.repo.ReplaceRecovery(ctx, userID, hashes)
}

// reauthenticate checks the current password when the account has one.
func (s *Service) reauthenticate(ctx context.Context, userID uuid.UUID, password *string) error {
	cred, err := s.users.CredentialsByID(ctx, userID)
	if err != nil {
		return err
	}
	if cred.PasswordHash == nil {
		return nil
	}
	if password == nil || *password == "" {
		return apperr.New(domain.ErrCurrentPassword, "current password required")
	}
	if _, err := crypto.VerifyPassword(*password, *cred.PasswordHash, s.cfg.Argon); err != nil {
		return apperr.New(domain.ErrCurrentPassword, "current password incorrect")
	}
	return nil
}

// secondFactorChallenge is the error a correct password earns when a code is still needed: it carries a
// short-lived token to present together with the code.
func (s *Service) secondFactorChallenge(userID uuid.UUID) error {
	tok, _, err := s.tokens.IssueScoped(userID, mfaScope, mfaTTL)
	if err != nil {
		return err
	}
	return apperr.New(domain.ErrTwoFactorRequired, "a verification code is required").WithMeta("token", tok)
}

// requiresSecondFactor reports whether the account has the factor on.
func (s *Service) requiresSecondFactor(ctx context.Context, userID uuid.UUID) (bool, error) {
	t, err := s.repo.TwoFactor(ctx, userID)
	return t != nil && t.Enabled, err
}

// LoginTwoFactor finishes a sign-in: the token from the password step and a code.
// Wrong codes count as failed sign-ins (the account locks after repeated ones).
func (s *Service) LoginTwoFactor(ctx context.Context, token, code string, c domain.Client) (domain.Session, error) {
	userID, err := s.tokens.VerifyScoped(token, mfaScope)
	if err != nil {
		return domain.Session{}, apperr.New(domain.ErrSessionExpired, "the sign-in expired, start again")
	}
	cred, err := s.users.CredentialsByID(ctx, userID)
	if err != nil {
		return domain.Session{}, err
	}
	now := s.now()
	if cred.LockedAt(now) {
		return domain.Session{}, s.lockedErr(*cred.LockedUntil)
	}
	if err := s.checkSecondFactor(ctx, userID, code); err != nil {
		if apperr.IsCode(err, domain.ErrTwoFactorCode) {
			_, lockedUntil, ferr := s.users.RecordLoginFailure(ctx, userID, s.cfg.LockThreshold, s.cfg.LockDuration)
			if ferr != nil {
				return domain.Session{}, ferr
			}
			if lockedUntil != nil && lockedUntil.After(now) {
				return domain.Session{}, s.lockedErr(*lockedUntil)
			}
		}
		return domain.Session{}, err
	}
	if cred.FailedLoginCount > 0 || cred.LockedUntil != nil {
		if err := s.users.ResetLoginFailures(ctx, userID); err != nil {
			return domain.Session{}, err
		}
	}
	return s.newSession(ctx, userID, c)
}
