// Package service implements authentication use cases: password and OAuth sign-in,
// rotating refresh sessions, email verification and password recovery.
package service

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

// Users is the port onto the users module (satisfied by users/service.Service).
type Users interface {
	Create(ctx context.Context, in usersdomain.NewUser) (usersdomain.User, error)
	Get(ctx context.Context, id uuid.UUID) (usersdomain.User, error)
	CredentialsByEmail(ctx context.Context, email string) (usersdomain.Credentials, error)
	CredentialsByID(ctx context.Context, id uuid.UUID) (usersdomain.Credentials, error)
	SetPasswordHash(ctx context.Context, id uuid.UUID, hash string) error
	MarkEmailVerified(ctx context.Context, id uuid.UUID) (usersdomain.User, error)
	RecordLoginFailure(ctx context.Context, id uuid.UUID, threshold int, lock time.Duration) (int, *time.Time, error)
	ResetLoginFailures(ctx context.Context, id uuid.UUID) error
	SetAvatarIfEmpty(ctx context.Context, id uuid.UUID, url string) error
}

// Repository is the persistence port (implemented by repository.Repo).
type Repository interface {
	CreateRefresh(ctx context.Context, n repository.NewRefresh) (uuid.UUID, error)
	Rotate(ctx context.Context, hash []byte, fn func(cur *repository.RefreshToken, rotate func(repository.NewRefresh) error, revokeFamily func() error) error) error
	FamilyByHash(ctx context.Context, hash []byte) (uuid.UUID, error)
	RevokeFamily(ctx context.Context, family uuid.UUID) error
	RevokeAllForUser(ctx context.Context, userID uuid.UUID) error
	RevokeOthersForUser(ctx context.Context, userID, keepFamily uuid.UUID) error
	Sessions(ctx context.Context, userID uuid.UUID) ([]repository.SessionRow, error)
	RevokeUserFamily(ctx context.Context, userID, family uuid.UUID) (bool, error)
	DeleteExpired(ctx context.Context) error
	IssueUserToken(ctx context.Context, userID uuid.UUID, purpose string, hash []byte, exp time.Time) (uuid.UUID, error)
	ConsumeUserToken(ctx context.Context, purpose string, hash []byte) (uuid.UUID, error)
	IdentityUser(ctx context.Context, provider, providerUserID string) (uuid.UUID, error)
	LinkIdentity(ctx context.Context, userID uuid.UUID, provider, providerUserID, email string) error
	ListProviders(ctx context.Context, userID uuid.UUID) ([]string, error)
	TwoFactor(ctx context.Context, userID uuid.UUID) (*repository.TwoFactor, error)
	StartTwoFactor(ctx context.Context, userID uuid.UUID, sealed []byte) (bool, error)
	EnableTwoFactor(ctx context.Context, userID uuid.UUID, step int64, recovery [][]byte) (bool, error)
	AcceptStep(ctx context.Context, userID uuid.UUID, step int64) (bool, error)
	UseRecovery(ctx context.Context, userID uuid.UUID, hash []byte) (bool, error)
	ReplaceRecovery(ctx context.Context, userID uuid.UUID, recovery [][]byte) error
	DisableTwoFactor(ctx context.Context, userID uuid.UUID) error
}

// MailQueue enqueues transactional email (mailer.Enqueue bound to the pool).
type MailQueue func(ctx context.Context, m mailer.Message, key string) error

type Config struct {
	PublicURL     string
	RefreshTTL    time.Duration
	VerifyTTL     time.Duration
	ResetTTL      time.Duration
	LockThreshold int
	LockDuration  time.Duration
	// RefreshGrace tolerates a just-rotated token being presented again (two tabs refreshing at once).
	RefreshGrace time.Duration
	Argon        crypto.Argon2Params
}

func DefaultConfig(publicURL string, refreshTTL time.Duration) Config {
	return Config{
		PublicURL: publicURL, RefreshTTL: refreshTTL,
		VerifyTTL: 48 * time.Hour, ResetTTL: time.Hour,
		LockThreshold: 5, LockDuration: 15 * time.Minute, RefreshGrace: 15 * time.Second,
		Argon: crypto.DefaultArgon2,
	}
}

type Service struct {
	cfg    Config
	users  Users
	repo   Repository
	tokens *authtoken.Manager
	bus    *eventbus.Bus
	mail   MailQueue
	sealer *crypto.Sealer
	now    func() time.Time
	// dummyHash keeps login timing similar for unknown emails (no user enumeration by timing).
	dummyHash string
}

func New(cfg Config, users Users, repo Repository, tokens *authtoken.Manager, bus *eventbus.Bus, mail MailQueue, sealer *crypto.Sealer) *Service {
	dummy, _ := crypto.HashPassword("lecodekanban-dummy-password", cfg.Argon)
	return &Service{cfg: cfg, users: users, repo: repo, tokens: tokens, bus: bus, mail: mail, sealer: sealer, now: time.Now, dummyHash: dummy}
}

// newSession creates a fresh refresh-token family and access token.
func (s *Service) newSession(ctx context.Context, userID uuid.UUID, c domain.Client) (domain.Session, error) {
	return s.issue(ctx, userID, uuid.New(), c, func(n repository.NewRefresh) error {
		_, err := s.repo.CreateRefresh(ctx, n)
		return err
	})
}

func (s *Service) issue(_ context.Context, userID, family uuid.UUID, c domain.Client, store func(repository.NewRefresh) error) (domain.Session, error) {
	raw, err := crypto.NewToken(32)
	if err != nil {
		return domain.Session{}, err
	}
	exp := s.now().Add(s.cfg.RefreshTTL)
	if err := store(repository.NewRefresh{
		UserID: userID, FamilyID: family, Hash: crypto.HashToken(raw), ExpiresAt: exp, UserAgent: c.UserAgent, IP: c.IP,
	}); err != nil {
		return domain.Session{}, err
	}
	access, accessExp, err := s.tokens.Issue(authtoken.Principal{UserID: userID, SessionID: family})
	if err != nil {
		return domain.Session{}, err
	}
	return domain.Session{
		UserID: userID, FamilyID: family, AccessToken: access, AccessExp: accessExp, RefreshToken: raw, RefreshExp: exp,
	}, nil
}

func (s *Service) ListProviders(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.repo.ListProviders(ctx, userID)
}

// Cleanup removes long-expired refresh tokens (run periodically by the worker).
func (s *Service) Cleanup(ctx context.Context) error { return s.repo.DeleteExpired(ctx) }
