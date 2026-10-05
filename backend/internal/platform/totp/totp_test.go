package totp

import (
	"strings"
	"testing"
	"time"
)

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890" (shown as 6 digits).
func TestRFC6238Vectors(t *testing.T) {
	secret := b32.EncodeToString([]byte("12345678901234567890"))
	for unix, want := range map[int64]string{59: "287082", 1111111109: "081804", 1111111111: "050471", 1234567890: "005924", 2000000000: "279037"} {
		got, err := Code(secret, time.Unix(unix, 0))
		if err != nil || got != want {
			t.Errorf("t=%d: got %q (%v), want %q", unix, got, err, want)
		}
	}
}

func TestVerifyWindowAndReplayStep(t *testing.T) {
	secret, err := NewSecret()
	if err != nil {
		t.Fatal(err)
	}
	now := time.Unix(1_700_000_000, 0)
	code, _ := Code(secret, now)
	step, ok := Verify(secret, code, now)
	if !ok || step != Counter(now) {
		t.Fatalf("current code: %d %v", step, ok)
	}
	if _, ok := Verify(secret, code, now.Add(Period*time.Second)); !ok {
		t.Error("the previous step is tolerated")
	}
	if _, ok := Verify(secret, code, now.Add(3*Period*time.Second)); ok {
		t.Error("an old code must fail")
	}
	if _, ok := Verify(secret, "12345", now); ok {
		t.Error("wrong length")
	}
	spaced := code[:3] + " " + code[3:]
	if _, ok := Verify(secret, spaced, now); !ok {
		t.Error("spaces are ignored")
	}
}

func TestURI(t *testing.T) {
	u := URI("Lecode Kanban", "a@b.co", "ABC")
	if !strings.HasPrefix(u, "otpauth://totp/Lecode%20Kanban:a@b.co?") || !strings.Contains(u, "secret=ABC") {
		t.Fatal(u)
	}
}
