package config

import (
	"os"
	"strings"
	"testing"
)

// isolate clears every LK_* variable (e.g. exported from .env by make) for this test.
func isolate(t *testing.T) {
	t.Helper()
	for _, kv := range os.Environ() {
		if k, _, _ := strings.Cut(kv, "="); strings.HasPrefix(k, "LK_") {
			t.Setenv(k, "")
			_ = os.Unsetenv(k)
		}
	}
}

func setValid(t *testing.T) {
	t.Helper()
	isolate(t)
	t.Setenv("LK_DATABASE_URL", "postgres://u:p@localhost:5432/db")
	t.Setenv("LK_SECRET_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYwMTIzNDU2Nzg5YWJjZGVm")
	t.Setenv("LK_ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
}

func TestLoadValid(t *testing.T) {
	setValid(t)
	c, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(c.EncryptionKeyBytes()) != 32 || len(c.SecretKeyBytes()) < 32 {
		t.Fatal("keys not decoded")
	}
	if _, ok := c.Redacted()["secret_key"]; ok {
		t.Fatal("redacted config must not contain secrets")
	}
}

func TestLoadAggregatesErrors(t *testing.T) {
	setValid(t)
	t.Setenv("LK_ENCRYPTION_KEY", "c2hvcnQ=")
	t.Setenv("LK_ENV", "staging")
	t.Setenv("LK_GOOGLE_CLIENT_ID", "only-id")
	_, err := Load()
	if err == nil {
		t.Fatal("expected error")
	}
	for _, want := range []string{"LK_ENCRYPTION_KEY", "LK_ENV", "LK_GOOGLE_CLIENT_ID"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("error should mention %s: %v", want, err)
		}
	}
}

func TestLoadRequiresDatabase(t *testing.T) {
	isolate(t)
	t.Setenv("LK_SECRET_KEY", "x")
	t.Setenv("LK_DATABASE_URL", "") // set-but-empty must count as missing
	if _, err := Load(); err == nil || !strings.Contains(err.Error(), "LK_DATABASE_URL") {
		t.Fatalf("expected missing database error, got %v", err)
	}
}
