package service_test

import (
	"context"
	"regexp"
	"sync"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/service"
	usersrepo "github.com/reliabilix/lecodekanban/backend/internal/modules/users/repository"
	userssvc "github.com/reliabilix/lecodekanban/backend/internal/modules/users/service"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/authtoken"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/crypto"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/testdb"
)

var tdb *testdb.DB

func TestMain(m *testing.M) { testdb.Main(m, &tdb) }

type outbox struct {
	mu   sync.Mutex
	msgs []mailer.Message
}

func (o *outbox) queue(_ context.Context, m mailer.Message, _ string) error {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.msgs = append(o.msgs, m)
	return nil
}

var tokenRE = regexp.MustCompile(`token=([A-Za-z0-9_-]+)`)

// lastToken extracts the token from the most recent email to `to`.
func (o *outbox) lastToken(t *testing.T, to string) string {
	t.Helper()
	o.mu.Lock()
	defer o.mu.Unlock()
	for i := len(o.msgs) - 1; i >= 0; i-- {
		if o.msgs[i].To == to {
			if m := tokenRE.FindStringSubmatch(o.msgs[i].Text); m != nil {
				return m[1]
			}
		}
	}
	t.Fatalf("no email with token to %s", to)
	return ""
}

type env struct {
	svc    *service.Service
	users  *userssvc.Service
	mail   *outbox
	bus    *eventbus.Bus
	tokens *authtoken.Manager
}

var client = domain.Client{IP: "127.0.0.1", UserAgent: "test"}

func setup(t *testing.T) env {
	t.Helper()
	tdb.Reset(t)
	bus := eventbus.New()
	users := userssvc.New(usersrepo.New(tdb.Pool), bus)
	tokens := authtoken.NewManager([]byte("0123456789abcdef0123456789abcdef"), 15*time.Minute)
	cfg := service.DefaultConfig("http://app.test", 24*time.Hour)
	cfg.Argon = crypto.Argon2Params{Memory: 8 * 1024, Iterations: 1, Parallelism: 1, SaltLen: 16, KeyLen: 32}
	mail := &outbox{}
	sealer, err := crypto.NewSealer([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	svc := service.New(cfg, users, repository.New(tdb.Pool), tokens, bus, mail.queue, sealer)
	return env{svc: svc, users: users, mail: mail, bus: bus, tokens: tokens}
}

func mustCode(t *testing.T, err error, code apperr.Code) {
	t.Helper()
	if !apperr.IsCode(err, code) {
		t.Fatalf("want %s, got %v", code, err)
	}
}

const pw = "Kanban-Board-2026"

func register(t *testing.T, e env, email string) domain.Session {
	t.Helper()
	s, err := e.svc.Register(context.Background(), service.RegisterInput{Name: "Lisa Kim", Email: email, Password: pw, Locale: "uk"}, client)
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	return s
}

func TestRegisterAndLogin(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	var registered []events.UserRegistered
	eventbus.Subscribe(e.bus, func(_ context.Context, ev events.UserRegistered) error {
		registered = append(registered, ev)
		return nil
	})

	s := register(t, e, "Lisa@Example.com")
	if s.AccessToken == "" || s.RefreshToken == "" {
		t.Fatal("session tokens missing")
	}
	if p, err := e.tokens.Verify(s.AccessToken); err != nil || p.UserID != s.UserID || p.SessionID != s.FamilyID {
		t.Fatalf("access token invalid: %v", err)
	}
	if len(registered) != 1 || registered[0].Email != "lisa@example.com" || registered[0].Via != "password" {
		t.Fatalf("UserRegistered not published correctly: %+v", registered)
	}
	if len(e.mail.msgs) != 1 || e.mail.msgs[0].Subject != "Підтвердіть email для LecodeKanban" {
		t.Fatalf("expected Ukrainian verification email, got %+v", e.mail.msgs)
	}

	_, err := e.svc.Register(ctx, service.RegisterInput{Name: "X", Email: "LISA@example.com", Password: pw}, client)
	mustCode(t, err, "users.email_taken")

	if _, err := e.svc.Login(ctx, "lisa@example.com", pw, client); err != nil {
		t.Fatalf("login: %v", err)
	}
	_, err = e.svc.Login(ctx, "lisa@example.com", "wrong-Password-1", client)
	mustCode(t, err, domain.ErrInvalidCredentials)
	_, err = e.svc.Login(ctx, "nobody@example.com", pw, client)
	mustCode(t, err, domain.ErrInvalidCredentials)
}

func TestRegisterValidation(t *testing.T) {
	e := setup(t)
	_, err := e.svc.Register(context.Background(), service.RegisterInput{Name: " ", Email: "x", Password: "alllowercase", Locale: "de"}, client)
	mustCode(t, err, apperr.Validation)
	fields := map[string]string{}
	for _, f := range apperr.From(err).Fields {
		fields[f.Field] = f.Code
	}
	want := map[string]string{"name": "required", "email": "email", "password": "password_weak", "locale": "one_of"}
	for k, v := range want {
		if fields[k] != v {
			t.Errorf("field %s: got %q want %q", k, fields[k], v)
		}
	}
}

func TestLockoutAfterRepeatedFailures(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	register(t, e, "lock@example.com")
	for i := 0; i < 4; i++ {
		_, err := e.svc.Login(ctx, "lock@example.com", "Wrong-Password-1", client)
		mustCode(t, err, domain.ErrInvalidCredentials)
	}
	_, err := e.svc.Login(ctx, "lock@example.com", "Wrong-Password-1", client)
	mustCode(t, err, domain.ErrAccountLocked)
	if apperr.From(err).Meta["retryAfter"] == nil {
		t.Fatal("locked error must carry retryAfter")
	}
	// Even the right password is refused while locked.
	_, err = e.svc.Login(ctx, "lock@example.com", pw, client)
	mustCode(t, err, domain.ErrAccountLocked)
}

func TestRefreshRotationAndReuseDetection(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	s1 := register(t, e, "rot@example.com")

	s2, err := e.svc.Refresh(ctx, s1.RefreshToken, client)
	if err != nil || s2.RefreshToken == "" || s2.RefreshToken == s1.RefreshToken || s2.FamilyID != s1.FamilyID {
		t.Fatalf("rotation failed: %v", err)
	}

	// Within the grace window the old token yields an access token but no new refresh token.
	g, err := e.svc.Refresh(ctx, s1.RefreshToken, client)
	if err != nil || g.AccessToken == "" || g.RefreshToken != "" {
		t.Fatalf("grace refresh: %+v %v", g, err)
	}

	// Outside the grace window, replaying the old token revokes the whole family.
	_, err = tdb.Pool.Exec(ctx, `UPDATE refresh_tokens SET revoked_at = now() - interval '1 minute' WHERE revoked_at IS NOT NULL`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Refresh(ctx, s1.RefreshToken, client)
	mustCode(t, err, domain.ErrSessionExpired)
	_, err = e.svc.Refresh(ctx, s2.RefreshToken, client)
	mustCode(t, err, domain.ErrSessionExpired)

	_, err = e.svc.Refresh(ctx, "", client)
	mustCode(t, err, domain.ErrSessionExpired)
	_, err = e.svc.Refresh(ctx, "unknown", client)
	mustCode(t, err, domain.ErrSessionExpired)
}

func TestLogoutRevokesOnlyThisDevice(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	a := register(t, e, "dev@example.com")
	b, err := e.svc.Login(ctx, "dev@example.com", pw, client)
	if err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Logout(ctx, a.RefreshToken); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Refresh(ctx, a.RefreshToken, client)
	mustCode(t, err, domain.ErrSessionExpired)
	if _, err := e.svc.Refresh(ctx, b.RefreshToken, client); err != nil {
		t.Fatalf("other device must stay signed in: %v", err)
	}
	if err := e.svc.Logout(ctx, "garbage"); err != nil {
		t.Fatalf("unknown token logout should be a no-op: %v", err)
	}
}

func TestVerifyEmail(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	s := register(t, e, "v@example.com")
	if err := e.svc.ResendVerification(ctx, s.UserID); err != nil {
		t.Fatal(err)
	}
	first := e.mail.msgs[0].Text
	tok := e.mail.lastToken(t, "v@example.com")
	if regexp.MustCompile(tok).MatchString(first) {
		t.Fatal("resend must issue a new token")
	}
	old := tokenRE.FindStringSubmatch(first)[1]
	mustCode(t, e.svc.VerifyEmail(ctx, old), domain.ErrTokenInvalid) // superseded

	if err := e.svc.VerifyEmail(ctx, tok); err != nil {
		t.Fatalf("verify: %v", err)
	}
	u, _ := e.users.Get(ctx, s.UserID)
	if !u.EmailVerified() {
		t.Fatal("email should be verified")
	}
	mustCode(t, e.svc.VerifyEmail(ctx, tok), domain.ErrTokenInvalid) // single use

	n := len(e.mail.msgs)
	if err := e.svc.ResendVerification(ctx, s.UserID); err != nil || len(e.mail.msgs) != n {
		t.Fatal("resend for a verified user must be a no-op")
	}
}

func TestPasswordReset(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	s := register(t, e, "reset@example.com")

	if err := e.svc.ForgotPassword(ctx, "unknown@example.com"); err != nil {
		t.Fatalf("unknown email must not error: %v", err)
	}
	mustCode(t, e.svc.ForgotPassword(ctx, "not-an-email"), apperr.Validation)
	if err := e.svc.ForgotPassword(ctx, "RESET@example.com"); err != nil {
		t.Fatal(err)
	}
	tok := e.mail.lastToken(t, "reset@example.com")

	mustCode(t, e.svc.ResetPassword(ctx, tok, "weak"), apperr.Validation)
	if err := e.svc.ResetPassword(ctx, tok, "Brand-New-Pass-77"); err != nil {
		t.Fatalf("reset: %v", err)
	}
	mustCode(t, e.svc.ResetPassword(ctx, tok, "Another-Pass-88"), domain.ErrTokenInvalid)

	_, err := e.svc.Refresh(ctx, s.RefreshToken, client)
	mustCode(t, err, domain.ErrSessionExpired) // all sessions revoked
	if _, err := e.svc.Login(ctx, "reset@example.com", "Brand-New-Pass-77", client); err != nil {
		t.Fatalf("login with new password: %v", err)
	}
}

func TestChangePassword(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	cur := register(t, e, "chg@example.com")
	other, _ := e.svc.Login(ctx, "chg@example.com", pw, client)

	wrong := "Nope-Nope-123"
	mustCode(t, e.svc.ChangePassword(ctx, cur.UserID, cur.FamilyID, &wrong, "Next-Pass-2026"), domain.ErrCurrentPassword)
	mustCode(t, e.svc.ChangePassword(ctx, cur.UserID, cur.FamilyID, nil, "Next-Pass-2026"), domain.ErrCurrentPassword)
	p := pw
	mustCode(t, e.svc.ChangePassword(ctx, cur.UserID, cur.FamilyID, &p, "short"), apperr.Validation)
	if err := e.svc.ChangePassword(ctx, cur.UserID, cur.FamilyID, &p, "Next-Pass-2026"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Refresh(ctx, cur.RefreshToken, client); err != nil {
		t.Fatalf("current session must survive: %v", err)
	}
	_, err := e.svc.Refresh(ctx, other.RefreshToken, client)
	mustCode(t, err, domain.ErrSessionExpired)
}

func TestOAuthLogin(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	gh := domain.ProviderProfile{Provider: "github", ID: "42", Email: "octo@example.com", EmailVerified: true, Name: "Octo Cat", AvatarURL: "https://avatars.test/42"}

	s, err := e.svc.OAuthLogin(ctx, gh, "en", client)
	if err != nil {
		t.Fatalf("new oauth user: %v", err)
	}
	u, _ := e.users.Get(ctx, s.UserID)
	if !u.EmailVerified() || u.HasPassword || u.AvatarURL == nil || u.Name != "Octo Cat" {
		t.Fatalf("unexpected new user %+v", u)
	}
	provs, _ := e.svc.ListProviders(ctx, s.UserID)
	if len(provs) != 1 || provs[0] != "github" {
		t.Fatalf("providers = %v", provs)
	}
	again, err := e.svc.OAuthLogin(ctx, gh, "en", client)
	if err != nil || again.UserID != s.UserID {
		t.Fatal("existing identity should sign in the same user")
	}

	// A verified Google email links to the existing password account.
	pwUser := register(t, e, "linked@example.com")
	g := domain.ProviderProfile{Provider: "google", ID: "g-1", Email: "Linked@Example.com", EmailVerified: true}
	ls, err := e.svc.OAuthLogin(ctx, g, "en", client)
	if err != nil || ls.UserID != pwUser.UserID {
		t.Fatalf("expected link to existing account: %v", err)
	}

	// Unverified provider emails are never linked or used to create accounts.
	bad := domain.ProviderProfile{Provider: "github", ID: "99", Email: "linked@example.com", EmailVerified: false}
	_, err = e.svc.OAuthLogin(ctx, bad, "en", client)
	mustCode(t, err, domain.ErrOAuthEmailUnverified)
	_, err = e.svc.OAuthLogin(ctx, domain.ProviderProfile{Provider: "github"}, "en", client)
	mustCode(t, err, domain.ErrOAuthFailed)
}

func TestDevices(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	phone := domain.Client{IP: "10.0.0.7", UserAgent: "Mozilla/5.0 (iPhone) Safari"}
	a := register(t, e, "devices@example.com")
	b, err := e.svc.Login(ctx, "devices@example.com", pw, phone)
	if err != nil {
		t.Fatal(err)
	}
	other := register(t, e, "someone@example.com")

	list, err := e.svc.Devices(ctx, a.UserID, a.FamilyID)
	if err != nil || len(list) != 2 {
		t.Fatalf("devices: %+v %v", list, err)
	}
	var current, remote *service.Device
	for i := range list {
		if list[i].Current {
			current = &list[i]
		} else {
			remote = &list[i]
		}
	}
	if current == nil || current.ID != a.FamilyID || current.UserAgent != "test" {
		t.Fatalf("current device: %+v", list)
	}
	if remote == nil || remote.ID != b.FamilyID || remote.IP != "10.0.0.7" || remote.UserAgent != phone.UserAgent {
		t.Fatalf("other device: %+v", list)
	}

	// Rotating the refresh token keeps one row per sign-in.
	rotated, err := e.svc.Refresh(ctx, b.RefreshToken, phone)
	if err != nil {
		t.Fatal(err)
	}
	if list, _ = e.svc.Devices(ctx, a.UserID, a.FamilyID); len(list) != 2 {
		t.Fatalf("rotation made %d devices", len(list))
	}

	// Somebody else's session cannot be signed out; your own can, and then it can no longer refresh.
	mustCode(t, e.svc.SignOutDevice(ctx, other.UserID, b.FamilyID), domain.ErrSessionNotFound)
	if err := e.svc.SignOutDevice(ctx, a.UserID, b.FamilyID); err != nil {
		t.Fatal(err)
	}
	_, err = e.svc.Refresh(ctx, rotated.RefreshToken, phone)
	mustCode(t, err, domain.ErrSessionExpired)
	mustCode(t, e.svc.SignOutDevice(ctx, a.UserID, b.FamilyID), domain.ErrSessionNotFound)

	// "Sign out everywhere else" keeps only the current device.
	c, _ := e.svc.Login(ctx, "devices@example.com", pw, phone)
	if err := e.svc.SignOutOtherDevices(ctx, a.UserID, a.FamilyID); err != nil {
		t.Fatal(err)
	}
	if list, _ = e.svc.Devices(ctx, a.UserID, a.FamilyID); len(list) != 1 || !list[0].Current {
		t.Fatalf("after signing out the others: %+v", list)
	}
	if _, err := e.svc.Refresh(ctx, c.RefreshToken, phone); err == nil {
		t.Fatal("an ended session refreshed")
	}
	if _, err := e.svc.Refresh(ctx, a.RefreshToken, client); err != nil {
		t.Fatalf("the current device must stay signed in: %v", err)
	}
}
