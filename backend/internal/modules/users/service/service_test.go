package service_test

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/storage/local"
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

// pictureBytes returns a tiny valid image of the given kind.
func pictureBytes(kind string) []byte {
	switch kind {
	case "png":
		return []byte("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xa7\x9a\xa0\xa0\x00\x00\x00\x00IEND\xaeB`\x82")
	case "jpeg":
		return []byte("\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9")
	}
	return nil
}

func TestAvatars(t *testing.T) {
	s, bus := setup(t)
	dir := t.TempDir()
	disk, err := local.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	s.WithAvatars(disk)
	ctx := context.Background()
	u, _ := s.Create(ctx, domain.NewUser{Email: "pic@example.com", Name: "Pic"})
	other, _ := s.Create(ctx, domain.NewUser{Email: "other@example.com", Name: "Other"})
	var changed int
	eventbus.Subscribe(bus, func(context.Context, events.ProfileUpdated) error { changed++; return nil })

	if _, _, err := s.OpenAvatar(ctx, u.ID); !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("no picture yet: %v", err)
	}
	// Only real pictures: the type comes from the bytes, so a script named .png is refused.
	if _, err := s.SetAvatar(ctx, u.ID, bytes.NewReader([]byte("<svg onload=alert(1)>"))); !apperr.IsCode(err, domain.ErrBadAvatar) {
		t.Fatalf("svg accepted: %v", err)
	}
	if _, err := s.SetAvatar(ctx, u.ID, bytes.NewReader(make([]byte, service.MaxAvatarBytes+1))); !apperr.IsCode(err, domain.ErrAvatarTooLarge) {
		t.Fatalf("oversized picture: %v", err)
	}

	got, err := s.SetAvatar(ctx, u.ID, bytes.NewReader(pictureBytes("png")))
	if err != nil || got.AvatarURL == nil || !strings.HasPrefix(*got.AvatarURL, "/api/v1/users/"+u.ID.String()+"/avatar?v=") || changed != 1 {
		t.Fatalf("set avatar: %+v %v changed=%d", got, err, changed)
	}
	f, kind, err := s.OpenAvatar(ctx, u.ID)
	if err != nil || kind != "image/png" {
		t.Fatalf("open: %v %q", err, kind)
	}
	b, _ := io.ReadAll(f)
	_ = f.Close()
	if !bytes.Equal(b, pictureBytes("png")) {
		t.Fatal("stored bytes differ")
	}

	// A new picture replaces the old one, with a new address and without leaving the old file behind.
	first := *got.AvatarURL
	got, err = s.SetAvatar(ctx, u.ID, bytes.NewReader(pictureBytes("jpeg")))
	if err != nil || *got.AvatarURL == first {
		t.Fatalf("replace: %+v %v", got, err)
	}
	if _, kind, _ := s.OpenAvatar(ctx, u.ID); kind != "image/jpeg" {
		t.Fatalf("type after replace: %q", kind)
	}
	files := 0
	_ = filepath.WalkDir(dir, func(_ string, d os.DirEntry, _ error) error {
		if d != nil && !d.IsDir() {
			files++
		}
		return nil
	})
	if files != 1 {
		t.Fatalf("%d files on disk after replacing, want 1", files)
	}
	if _, _, err := s.OpenAvatar(ctx, other.ID); !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("somebody else's picture: %v", err)
	}

	got, err = s.RemoveAvatar(ctx, u.ID)
	if err != nil || got.AvatarURL != nil {
		t.Fatalf("remove: %+v %v", got, err)
	}
	if _, _, err := s.OpenAvatar(ctx, u.ID); !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("after remove: %v", err)
	}
}

func TestProfileDetails(t *testing.T) {
	s, _ := setup(t)
	ctx := context.Background()
	u, _ := s.Create(ctx, domain.NewUser{Email: "d@example.com", Name: "D"})

	got, err := s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{JobTitle: ptr("  Engineer "), Phone: ptr("+380 50 000 00 00"),
		Location: ptr("Kyiv"), Timezone: ptr("Europe/Kyiv"), Bio: ptr("Hello")})
	if err != nil || got.JobTitle != "Engineer" || got.Timezone != "Europe/Kyiv" || got.Bio != "Hello" || got.Location != "Kyiv" {
		t.Fatalf("details: %+v %v", got, err)
	}
	// A patch that leaves them out keeps them; an empty string clears one.
	got, _ = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Name: ptr("D2"), Bio: ptr("")})
	if got.JobTitle != "Engineer" || got.Bio != "" || got.Name != "D2" {
		t.Fatalf("partial patch: %+v", got)
	}
	_, err = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Timezone: ptr("Mars/Olympus"), Bio: ptr(strings.Repeat("x", 501))})
	if !apperr.IsCode(err, apperr.Validation) || len(apperr.From(err).Fields) != 2 {
		t.Fatalf("want 2 field errors, got %v", err)
	}
	if _, err = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Timezone: ptr("")}); err != nil {
		t.Fatalf("clearing the time zone: %v", err)
	}
}

func TestProfileExtrasAndCover(t *testing.T) {
	s, _ := setup(t)
	disk, err := local.New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	s.WithAvatars(disk)
	ctx := context.Background()
	u, _ := s.Create(ctx, domain.NewUser{Email: "x@example.com", Name: "X"})

	got, err := s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{
		Pronouns: ptr(" she/her "), LinkedIn: ptr("anna-k"), Telegram: ptr("https://t.me/@anna_k1"),
		Website: ptr("example.com/me"), WorkStart: ptr("09:00"), WorkEnd: ptr("17:30"),
		Skills: ptr([]string{" Go ", "go", "Design", ""}), CoverPreset: ptr("ocean")})
	if err != nil {
		t.Fatal(err)
	}
	if got.Pronouns != "she/her" || got.LinkedIn != "https://www.linkedin.com/in/anna-k" || got.Telegram != "anna_k1" ||
		got.Website != "https://example.com/me" || got.WorkStart != "09:00" || got.CoverPreset != "ocean" ||
		len(got.Skills) != 2 || got.Skills[0] != "Go" {
		t.Fatalf("normalised: %+v", got)
	}
	// Leaving fields out keeps them; an empty value clears one.
	got, _ = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{Telegram: ptr("")})
	if got.Telegram != "" || got.LinkedIn == "" || len(got.Skills) != 2 {
		t.Fatalf("partial: %+v", got)
	}
	for name, p := range map[string]domain.ProfilePatch{
		"linkedin": {LinkedIn: ptr("https://evil.example.com/in/x")},
		"telegram": {Telegram: ptr("ab")},
		"website":  {Website: ptr("javascript:alert(1)")},
		"workEnd":  {WorkStart: ptr("18:00"), WorkEnd: ptr("09:00")},
		"skills":   {Skills: ptr([]string{"a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"})},
		"cover":    {CoverPreset: ptr("neon")},
	} {
		if _, err := s.UpdateProfile(ctx, u.ID, p); !apperr.IsCode(err, apperr.Validation) {
			t.Errorf("%s accepted: %v", name, err)
		}
	}
	got, _ = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{WorkStart: ptr(""), WorkEnd: ptr("")})
	if got.WorkStart != "" {
		t.Fatalf("clearing hours: %+v", got)
	}

	// An uploaded cover wins over a preset; choosing a preset again drops the upload.
	if _, err := s.SetCover(ctx, u.ID, bytes.NewReader([]byte("<svg onload=alert(1)>"))); !apperr.IsCode(err, domain.ErrBadCover) {
		t.Fatalf("svg cover accepted: %v", err)
	}
	if _, err := s.SetCover(ctx, u.ID, bytes.NewReader(make([]byte, service.MaxCoverBytes+1))); !apperr.IsCode(err, domain.ErrCoverTooLarge) {
		t.Fatalf("oversized cover: %v", err)
	}
	got, err = s.SetCover(ctx, u.ID, bytes.NewReader(pictureBytes("png")))
	if err != nil || got.CoverURL == nil || got.CoverPreset != "" {
		t.Fatalf("cover: %+v %v", got, err)
	}
	if _, kind, err := s.OpenCover(ctx, u.ID); err != nil || kind != "image/png" {
		t.Fatalf("open cover: %v %q", err, kind)
	}
	got, _ = s.UpdateProfile(ctx, u.ID, domain.ProfilePatch{CoverPreset: ptr("forest")})
	if got.CoverURL != nil || got.CoverPreset != "forest" {
		t.Fatalf("preset replaces upload: %+v", got)
	}
	if _, _, err := s.OpenCover(ctx, u.ID); !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("file still served: %v", err)
	}
}
