package authtoken

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

func TestIssueVerify(t *testing.T) {
	m := NewManager([]byte("0123456789abcdef0123456789abcdef"), 15*time.Minute)
	p := Principal{UserID: uuid.New(), SessionID: uuid.New()}
	tok, exp, err := m.Issue(p)
	if err != nil || time.Until(exp) < 14*time.Minute {
		t.Fatalf("issue: %v", err)
	}
	got, err := m.Verify(tok)
	if err != nil || got != p {
		t.Fatalf("verify: %v %v", got, err)
	}
}

func TestVerifyRejects(t *testing.T) {
	key := []byte("0123456789abcdef0123456789abcdef")
	m := NewManager(key, time.Minute)
	tok, _, _ := m.Issue(Principal{UserID: uuid.New(), SessionID: uuid.New()})

	other := NewManager([]byte("ffffffffffffffffffffffffffffffff"), time.Minute)
	if _, err := other.Verify(tok); !errors.Is(err, ErrInvalid) {
		t.Error("wrong key must fail")
	}

	expired := NewManager(key, time.Minute)
	expired.now = func() time.Time { return time.Now().Add(2 * time.Hour) }
	if _, err := expired.Verify(tok); !errors.Is(err, ErrInvalid) {
		t.Error("expired token must fail")
	}

	none, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{"sub": uuid.NewString()}).
		SignedString(jwt.UnsafeAllowNoneSignatureType)
	if _, err := m.Verify(none); !errors.Is(err, ErrInvalid) {
		t.Error("alg=none must be rejected")
	}
	if _, err := m.Verify("garbage"); !errors.Is(err, ErrInvalid) {
		t.Error("garbage must fail")
	}
}

func TestContext(t *testing.T) {
	if _, ok := FromContext(context.Background()); ok {
		t.Fatal("empty context has no principal")
	}
	p := Principal{UserID: uuid.New()}
	got, ok := FromContext(WithPrincipal(context.Background(), p))
	if !ok || got != p {
		t.Fatal("principal round-trip failed")
	}
}
