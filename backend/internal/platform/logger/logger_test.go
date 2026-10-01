package logger

import (
	"bytes"
	"context"
	"strings"
	"testing"
)

func TestRedactsSensitiveKeys(t *testing.T) {
	var buf bytes.Buffer
	l := New(&buf, "debug", true)
	l.Info("login", "password", "hunter2", "Token", "abc", "email", "a@b.c")
	out := buf.String()
	if strings.Contains(out, "hunter2") || strings.Contains(out, "abc\"") {
		t.Fatalf("secret leaked: %s", out)
	}
	if !strings.Contains(out, "a@b.c") {
		t.Fatalf("non-secret attribute missing: %s", out)
	}
}

func TestContextLogger(t *testing.T) {
	var buf bytes.Buffer
	l := New(&buf, "info", false)
	From(With(context.Background(), l)).Info("hello")
	if !strings.Contains(buf.String(), "hello") {
		t.Fatal("expected context logger to be used")
	}
}
