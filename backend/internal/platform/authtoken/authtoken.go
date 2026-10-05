// Package authtoken issues and verifies short-lived HS256 access tokens and
// carries the authenticated principal through request contexts.
package authtoken

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	issuer   = "lecodekanban"
	audience = "lecodekanban-api"
)

var ErrInvalid = errors.New("authtoken: invalid or expired token")

// Principal is the authenticated caller.
type Principal struct {
	UserID    uuid.UUID
	SessionID uuid.UUID // refresh-token family; lets logout revoke this device only
}

type claims struct {
	SessionID string `json:"sid"`
	jwt.RegisteredClaims
}

type Manager struct {
	key []byte
	ttl time.Duration
	now func() time.Time
}

func NewManager(key []byte, ttl time.Duration) *Manager {
	return &Manager{key: key, ttl: ttl, now: time.Now}
}

func (m *Manager) TTL() time.Duration { return m.ttl }

func (m *Manager) Issue(p Principal) (string, time.Time, error) {
	now := m.now()
	exp := now.Add(m.ttl)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims{
		SessionID: p.SessionID.String(),
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{audience},
			Subject:   p.UserID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now.Add(-30 * time.Second)),
			ExpiresAt: jwt.NewNumericDate(exp),
		},
	})
	s, err := tok.SignedString(m.key)
	return s, exp, err
}

func (m *Manager) Verify(token string) (Principal, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(*jwt.Token) (any, error) { return m.key, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer), jwt.WithAudience(audience), jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(m.now), jwt.WithLeeway(5*time.Second))
	if err != nil {
		return Principal{}, ErrInvalid
	}
	uid, err1 := uuid.Parse(c.Subject)
	sid, err2 := uuid.Parse(c.SessionID)
	if err1 != nil || err2 != nil {
		return Principal{}, ErrInvalid
	}
	return Principal{UserID: uid, SessionID: sid}, nil
}

const scopedAudience = "lecodekanban-"

// IssueScoped signs a short-lived token for one narrow purpose (for example the step between a correct
// password and the second factor). It carries a different audience, so Verify never accepts it as an access token.
func (m *Manager) IssueScoped(userID uuid.UUID, scope string, ttl time.Duration) (string, time.Time, error) {
	now := m.now()
	exp := now.Add(ttl)
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{scopedAudience + scope},
		Subject:   userID.String(),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(exp),
	})
	s, err := tok.SignedString(m.key)
	return s, exp, err
}

// VerifyScoped returns the user a scoped token was issued for.
func (m *Manager) VerifyScoped(token, scope string) (uuid.UUID, error) {
	var c jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(token, &c, func(*jwt.Token) (any, error) { return m.key, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer), jwt.WithAudience(scopedAudience+scope), jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(m.now), jwt.WithLeeway(5*time.Second))
	if err != nil {
		return uuid.Nil, ErrInvalid
	}
	uid, err := uuid.Parse(c.Subject)
	if err != nil {
		return uuid.Nil, ErrInvalid
	}
	return uid, nil
}

type ctxKey struct{}

func WithPrincipal(ctx context.Context, p Principal) context.Context {
	return context.WithValue(ctx, ctxKey{}, p)
}

// FromContext returns the principal set by the auth middleware.
func FromContext(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(ctxKey{}).(Principal)
	return p, ok
}
