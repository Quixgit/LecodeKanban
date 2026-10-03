package domain_test

import (
	"reflect"
	"testing"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/github/domain"
)

func TestExtractKeys(t *testing.T) {
	got := domain.ExtractKeys("Fix login (PLT-12)", "feature/plt-12-login-and-DEV-7", "closes ITC-1, see plt-12 again; not-a-key, X-1, TOOLONGPROJECT-3")
	want := []domain.Key{{"PLT", 12}, {"DEV", 7}, {"ITC", 1}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("keys = %+v, want %+v", got, want)
	}
	if len(domain.ExtractKeys("nothing here", "PLT-0", "X-1")) != 0 {
		t.Fatal("number zero and one-letter prefixes are not keys")
	}
}

func TestBranchName(t *testing.T) {
	cases := map[string]string{
		"Migrate server to new infrastructure": "plt-12-migrate-server-to-new-infrastructure",
		"  Fix: login!!  (urgent) ":            "plt-12-fix-login-urgent",
		"Вхід через Google":                    "plt-12-google",
	}
	for title, want := range cases {
		if got := domain.BranchName("PLT-12", title); got != want {
			t.Errorf("%q -> %q, want %q", title, got, want)
		}
	}
	long := domain.BranchName("PLT-12", "one two three four five six seven eight nine ten eleven twelve thirteen")
	if len(long) > 60 {
		t.Errorf("branch too long: %d", len(long))
	}
}

func TestIssueMarker(t *testing.T) {
	id := uuid.New()
	got, ok := domain.MarkedCard("Body text\n\n" + domain.IssueMarker(id))
	if !ok || got != id {
		t.Fatalf("marker round trip: %v %v", got, ok)
	}
	if _, ok := domain.MarkedCard("plain issue"); ok {
		t.Fatal("no marker expected")
	}
	if _, ok := domain.MarkedCard("<!-- lk:card=not-a-uuid -->"); ok {
		t.Fatal("bad id accepted")
	}
}
