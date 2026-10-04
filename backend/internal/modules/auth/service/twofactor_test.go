package service_test

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/auth/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/totp"
)

func codeAt(t *testing.T, secret string, d time.Duration) string {
	t.Helper()
	c, err := totp.Code(secret, time.Now().Add(d))
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func tokenOf(t *testing.T, err error) string {
	t.Helper()
	mustCode(t, err, domain.ErrTwoFactorRequired)
	tok, _ := apperr.From(err).Meta["token"].(string)
	if tok == "" {
		t.Fatal("the challenge must carry a token")
	}
	return tok
}

func TestTwoFactorLifecycle(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	s := register(t, e, "mfa@example.com")
	uid := s.UserID

	st, _ := e.svc.TwoFactorStatus(ctx, uid)
	if st.Enabled {
		t.Fatal("off by default")
	}

	// Until a code is confirmed, signing in is unchanged.
	su, err := e.svc.SetupTwoFactor(ctx, uid)
	if err != nil || !strings.HasPrefix(su.URI, "otpauth://totp/") || su.Secret == "" {
		t.Fatalf("setup: %+v %v", su, err)
	}
	if _, err := e.svc.Login(ctx, "mfa@example.com", pw, client); err != nil {
		t.Fatalf("login before enabling: %v", err)
	}
	_, err = e.svc.EnableTwoFactor(ctx, uid, "000000")
	mustCode(t, err, domain.ErrTwoFactorCode)
	codes, err := e.svc.EnableTwoFactor(ctx, uid, codeAt(t, su.Secret, 0))
	if err != nil || len(codes) != 8 {
		t.Fatalf("enable: %v %v", codes, err)
	}
	if st, _ := e.svc.TwoFactorStatus(ctx, uid); !st.Enabled || st.RecoveryRemaining != 8 {
		t.Fatalf("status %+v", st)
	}
	if _, err := e.svc.SetupTwoFactor(ctx, uid); !apperr.IsCode(err, domain.ErrTwoFactorState) {
		t.Fatalf("setup while on: %v", err)
	}

	// A correct password now earns a challenge, not a session.
	_, err = e.svc.Login(ctx, "mfa@example.com", pw, client)
	tok := tokenOf(t, err)
	// The access token machinery does not accept the challenge token.
	if _, verr := e.tokens.Verify(tok); verr == nil {
		t.Fatal("challenge token must not be an access token")
	}
	// Wrong code, then a valid code from the next step (the enabling step is spent).
	_, err = e.svc.LoginTwoFactor(ctx, tok, "123456", client)
	mustCode(t, err, domain.ErrTwoFactorCode)
	good := codeAt(t, su.Secret, totp.Period*time.Second)
	if _, err := e.svc.LoginTwoFactor(ctx, tok, good, client); err != nil {
		t.Fatalf("second step: %v", err)
	}
	// The same code never works twice.
	_, err = e.svc.LoginTwoFactor(ctx, tok, good, client)
	mustCode(t, err, domain.ErrTwoFactorCode)
	// A tampered token is refused.
	_, err = e.svc.LoginTwoFactor(ctx, tok+"x", good, client)
	mustCode(t, err, domain.ErrSessionExpired)

	// A recovery code works once.
	if _, err := e.svc.LoginTwoFactor(ctx, tok, codes[0], client); err != nil {
		t.Fatalf("recovery code: %v", err)
	}
	_, err = e.svc.LoginTwoFactor(ctx, tok, codes[0], client)
	mustCode(t, err, domain.ErrTwoFactorCode)
	if st, _ := e.svc.TwoFactorStatus(ctx, uid); st.RecoveryRemaining != 7 {
		t.Fatalf("one recovery code used: %+v", st)
	}

	// New recovery codes replace the old ones.
	fresh, err := e.svc.RegenerateRecoveryCodes(ctx, uid, codes[1])
	if err != nil || len(fresh) != 8 {
		t.Fatalf("regenerate: %v %v", fresh, err)
	}
	_, err = e.svc.LoginTwoFactor(ctx, tok, codes[2], client)
	mustCode(t, err, domain.ErrTwoFactorCode)
	if _, err := e.svc.LoginTwoFactor(ctx, tok, fresh[0], client); err != nil {
		t.Fatalf("new recovery code: %v", err)
	}

	// Turning it off needs the password and a code.
	wrong := "nope"
	mustCode(t, e.svc.DisableTwoFactor(ctx, uid, &wrong, fresh[1]), domain.ErrCurrentPassword)
	mustCode(t, e.svc.DisableTwoFactor(ctx, uid, nil, fresh[1]), domain.ErrCurrentPassword)
	p := pw
	mustCode(t, e.svc.DisableTwoFactor(ctx, uid, &p, "000000"), domain.ErrTwoFactorCode)
	if err := e.svc.DisableTwoFactor(ctx, uid, &p, fresh[1]); err != nil {
		t.Fatalf("disable: %v", err)
	}
	if _, err := e.svc.Login(ctx, "mfa@example.com", pw, client); err != nil {
		t.Fatalf("login after disabling: %v", err)
	}
}

func TestTwoFactorLocksAfterRepeatedWrongCodes(t *testing.T) {
	e := setup(t)
	ctx := context.Background()
	s := register(t, e, "lock@example.com")
	su, _ := e.svc.SetupTwoFactor(ctx, s.UserID)
	if _, err := e.svc.EnableTwoFactor(ctx, s.UserID, codeAt(t, su.Secret, 0)); err != nil {
		t.Fatal(err)
	}
	_, err := e.svc.Login(ctx, "lock@example.com", pw, client)
	tok := tokenOf(t, err)
	var last error
	for i := 0; i < 5; i++ {
		_, last = e.svc.LoginTwoFactor(ctx, tok, "111111", client)
	}
	mustCode(t, last, domain.ErrAccountLocked)
}
