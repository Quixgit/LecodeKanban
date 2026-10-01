package service

import (
	"context"
	"log/slog"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

// Refresh rotates a refresh token. Presenting an already-rotated token outside the
// grace window is treated as theft: the whole session family is revoked.
func (s *Service) Refresh(ctx context.Context, rawRefresh string, c domain.Client) (domain.Session, error) {
	expired := apperr.New(domain.ErrSessionExpired, "session expired")
	if rawRefresh == "" {
		return domain.Session{}, expired
	}
	var out domain.Session
	var reuse bool
	err := s.repo.Rotate(ctx, crypto.HashToken(rawRefresh),
		func(cur *repository.RefreshToken, rotate func(repository.NewRefresh) error, revokeFamily func() error) error {
			now := s.now()
			switch {
			case cur == nil:
				return expired
			case cur.RevokedAt != nil && cur.ReplacedBy != nil && now.Sub(*cur.RevokedAt) <= s.cfg.RefreshGrace:
				// Benign race: another tab rotated this token a moment ago and the browser
				// already holds the replacement cookie. Mint an access token only.
				access, exp, err := s.tokens.Issue(authtoken.Principal{UserID: cur.UserID, SessionID: cur.FamilyID})
				if err != nil {
					return err
				}
				out = domain.Session{UserID: cur.UserID, FamilyID: cur.FamilyID, AccessToken: access, AccessExp: exp}
				return nil
			case cur.RevokedAt != nil:
				if cur.ReplacedBy != nil {
					reuse = true
					if err := revokeFamily(); err != nil {
						return err
					}
					return nil // commit the revocation, report expiry below
				}
				return expired
			case !cur.ExpiresAt.After(now):
				return expired
			}
			sess, err := s.issue(ctx, cur.UserID, cur.FamilyID, c, rotate)
			out = sess
			return err
		})
	if err != nil {
		return domain.Session{}, err
	}
	if reuse {
		logger.From(ctx).Warn("refresh token reuse detected; session family revoked", slog.String("ip", c.IP))
		return domain.Session{}, expired
	}
	return out, nil
}

// Logout revokes the session family of the presented refresh token (this device only).
func (s *Service) Logout(ctx context.Context, rawRefresh string) error {
	if rawRefresh == "" {
		return nil
	}
	fam, err := s.repo.FamilyByHash(ctx, crypto.HashToken(rawRefresh))
	if err != nil || fam == [16]byte{} {
		return err
	}
	return s.repo.RevokeFamily(ctx, fam)
}
