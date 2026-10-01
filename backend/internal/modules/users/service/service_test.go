package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

func setup(t *testing.T) (*service.Service, *eventbus.Bus) {
	t.Helper()
	tdb.Reset(t)
	bus := eventbus.New()
	return service.New(repository.New(tdb.Pool), bus), bus
}

func ptr[T any](v T) *T { return &v }

func TestCreateGetAndNormalisation(t *testing.T) {
	s, _ := setup(t)
	ctx := context.Background()
	u, err := s.Create(ctx, domain.NewUser{Email: "  Nina.Ross@Example.COM ", Name: " Nina Ross ", Locale: "fr"})
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != "nina.ross@example.com" || u.Name != "Nina Ross" || u.Locale != domain.LocaleEN || u.HasPassword || u.EmailVerified() {
		t.Fatalf("unexpected %+v", u)
	}
	_, err = s.Create(ctx, domain.NewUser{Email: "NINA.ROSS@example.com", Name: "Dup"})
	if !apperr.IsCode(err, domain.ErrEmailTaken) {
		t.Fatalf("want email_taken, got %v", err)
	}
	cred, err := s.CredentialsByEmail(ctx, "Nina.Ross@example.com")
	if err != nil || cred.User.ID != u.ID {
		t.Fatalf("lookup by email: %v", err)
	}
	many, err := s.GetMany(ctx, nil)
	if err != nil || many != nil {
		t.Fatal("empty GetMany should short-circuit")
	}
	_, err = s.CredentialsByEmail(ctx, "missing@example.com")
	if !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("want not_found, got %v", err)
	}
}

func TestUpdateProfile(t *testing.T) {
	s, bus := setup(t)
	ctx := context.Background()
	var published int
	eventbus.Subscribe(bus, func(context.Context, events.ProfileUpdated) error { published++; return nil })
	u, _ := s.Create(ctx, domain.NewUser{Email: "a@example.com", Name: "A"})

	_, err := s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Name: ptr("   "), Locale: ptr(domain.Locale("de"))})
	if !apperr.IsCode(err, apperr.Validation) || len(apperr.From(err).Fields) != 2 {
		t.Fatalf("want 2 field errors, got %v", err)
	}
	upd, err := s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Name: ptr(" Анна "), Locale: ptr(domain.LocaleUK)})
	if err != nil || upd.Name != "Анна" || upd.Locale != domain.LocaleUK || published != 1 {
		t.Fatalf("update: %+v %v (events %d)", upd, err, published)
	}
	same, _ := s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{})
	if same.Name != "Анна" {
		t.Fatal("empty patch must keep values")
	}
}

func TestLoginFailureCounters(t *testing.T) {
	s, _ := setup(t)
	ctx := context.Background()
	u, _ := s.Create(ctx, domain.NewUser{Email: "l@example.com", Name: "L"})
	for i := 1; i <= 3; i++ {
		n, locked, err := s.RecordLoginFailure(ctx, u.ID, 3, time.Minute)
		if err != nil || n != i || (i < 3) != (locked == nil) {
			t.Fatalf("attempt %d: n=%d locked=%v err=%v", i, n, locked, err)
		}
	}
	cred, _ := s.CredentialsByID(ctx, u.ID)
	if !cred.LockedAt(time.Now()) {
		t.Fatal("account should be locked")
	}
	if err := s.ResetLoginFailures(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	cred, _ = s.CredentialsByID(ctx, u.ID)
	if cred.FailedLoginCount != 0 || cred.LockedAt(time.Now()) {
		t.Fatal("reset failed")
	}
	if err := s.SetAvatarIfEmpty(ctx, u.ID, "https://a.test/1.png"); err != nil {
		t.Fatal(err)
	}
	_ = s.SetAvatarIfEmpty(ctx, u.ID, "https://a.test/2.png")
	got, _ := s.Get(ctx, u.ID)
	if got.AvatarURL == nil || *got.AvatarURL != "https://a.test/1.png" {
		t.Fatal("avatar must only be set when empty")
	}
}
