package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestNormalizeName(t *testing.T) {
	for in, want := range map[string]string{"General": "general", "  #Dev Ops ": "dev-ops", "a_b": "a_b"} {
		if got := NormalizeName(in); got != want {
			t.Errorf("NormalizeName(%q) = %q, want %q", in, got, want)
		}
	}
	for _, bad := range []string{"", "-x", "a b", "ü", string(make([]byte, 41))} {
		if ValidName(bad) {
			t.Errorf("%q should be invalid", bad)
		}
	}
}

func TestDMKeyIgnoresOrder(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	if DMKey([]uuid.UUID{a, b}) != DMKey([]uuid.UUID{b, a}) {
		t.Fatal("key depends on order")
	}
}

func TestParseMentions(t *testing.T) {
	id := uuid.New()
	body := "hi @[Lisa](" + id.String() + ") and again @[Lisa](" + id.String() + ") @[x](not-a-uuid)"
	got := ParseMentions(body)
	if len(got) != 1 || got[0] != id {
		t.Fatalf("got %v", got)
	}
}

func TestReactionSet(t *testing.T) {
	if !ValidReaction("thumbs-up") || ValidReaction("boom") || ValidReaction("") {
		t.Fatal("reaction validation wrong")
	}
}

func TestMentionsAll(t *testing.T) {
	for body, want := range map[string]bool{"@channel please look": true, "ping (@here)": true, "hey @everyone": true,
		"mail a@channel.com": false, "@channels": false, "plain": false} {
		if MentionsAll(body) != want {
			t.Errorf("MentionsAll(%q) = %v, want %v", body, !want, want)
		}
	}
}
