package crypto

import (
	"bytes"
	"errors"
	"strings"
	"testing"
)

var fast = Argon2Params{Memory: 8 * 1024, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}

func TestPasswordRoundTrip(t *testing.T) {
	h, err := HashPassword("correct horse Battery 9", fast)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(h, "$argon2id$v=19$m=8192,t=1,p=1$") {
		t.Fatalf("unexpected encoding %s", h)
	}
	rehash, err := VerifyPassword("correct horse Battery 9", h, fast)
	if err != nil || rehash {
		t.Fatalf("verify: rehash=%v err=%v", rehash, err)
	}
	if _, err := VerifyPassword("wrong", h, fast); !errors.Is(err, ErrMismatchedHash) {
		t.Fatalf("expected mismatch, got %v", err)
	}
	if rehash, _ := VerifyPassword("correct horse Battery 9", h, DefaultArgon2); !rehash {
		t.Fatal("weaker params should request rehash")
	}
	h2, _ := HashPassword("correct horse Battery 9", fast)
	if h == h2 {
		t.Fatal("salts must differ")
	}
}

func TestVerifyRejectsGarbage(t *testing.T) {
	for _, bad := range []string{"", "$bcrypt$x", "$argon2id$v=19$m=x$a$b", "$argon2id$v=18$m=1,t=1,p=1$a$b"} {
		if _, err := VerifyPassword("x", bad, fast); err == nil {
			t.Errorf("expected error for %q", bad)
		}
	}
}

func TestSealer(t *testing.T) {
	s, err := NewSealer(bytes.Repeat([]byte{7}, 32))
	if err != nil {
		t.Fatal(err)
	}
	ct, err := s.Seal([]byte("gho_secret"), []byte("user-1"))
	if err != nil {
		t.Fatal(err)
	}
	pt, err := s.Open(ct, []byte("user-1"))
	if err != nil || string(pt) != "gho_secret" {
		t.Fatalf("open: %q %v", pt, err)
	}
	if _, err := s.Open(ct, []byte("user-2")); !errors.Is(err, ErrDecrypt) {
		t.Fatal("associated data must be authenticated")
	}
	ct[len(ct)-1] ^= 1
	if _, err := s.Open(ct, []byte("user-1")); !errors.Is(err, ErrDecrypt) {
		t.Fatal("tampering must be detected")
	}
	if _, err := NewSealer([]byte("short")); err == nil {
		t.Fatal("short key must be rejected")
	}
}

func TestTokens(t *testing.T) {
	a, _ := NewToken(32)
	b, _ := NewToken(32)
	if a == b || len(a) != 43 {
		t.Fatalf("bad tokens %q %q", a, b)
	}
	if !bytes.Equal(HashToken(a), HashToken(a)) || bytes.Equal(HashToken(a), HashToken(b)) {
		t.Fatal("hash must be deterministic and distinct")
	}
}
