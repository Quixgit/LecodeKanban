package mailer

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
)

func mailgunAgainst(t *testing.T, status int, check func(*http.Request)) *MailgunSender {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if check != nil {
			check(r)
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(`{"message":"x"}`))
	}))
	t.Cleanup(srv.Close)
	s := NewMailgunSender(config.MailConfig{MailgunAPIKey: "key-secret", MailgunDomain: "mg.example.com", MailgunRegion: "us"},
		"LecodeKanban <no-reply@mg.example.com>")
	s.base = srv.URL
	return s
}

func TestMailgunSendsFormWithBasicAuth(t *testing.T) {
	s := mailgunAgainst(t, http.StatusOK, func(r *http.Request) {
		if r.URL.Path != "/v3/mg.example.com/messages" || r.Method != http.MethodPost {
			t.Errorf("request %s %s", r.Method, r.URL.Path)
		}
		if u, p, ok := r.BasicAuth(); !ok || u != "api" || p != "key-secret" {
			t.Errorf("basic auth = %q %q %v", u, p, ok)
		}
		_ = r.ParseForm()
		if r.Form.Get("to") != "peter@example.com" || r.Form.Get("subject") != "Hi" ||
			r.Form.Get("from") != "LecodeKanban <no-reply@mg.example.com>" || r.Form.Get("html") != "<b>x</b>" {
			t.Errorf("form = %v", r.Form)
		}
	})
	if err := s.Send(context.Background(), Message{To: "peter@example.com", Subject: "Hi", Text: "x", HTML: "<b>x</b>"}); err != nil {
		t.Fatal(err)
	}
}

func TestMailgunErrorClassification(t *testing.T) {
	for status, permanent := range map[int]bool{401: true, 400: true, 403: true, 413: true, 429: false, 500: false, 503: false} {
		err := mailgunAgainst(t, status, nil).Send(context.Background(), Message{To: "a@b.co"})
		var perm jobs.Permanent
		if err == nil || errors.As(err, &perm) != permanent {
			t.Errorf("status %d: permanent=%v err=%v", status, errors.As(err, &perm), err)
		}
		if err != nil && strings.Contains(err.Error(), "key-secret") {
			t.Errorf("the API key leaked into the error: %v", err)
		}
	}
}

func TestMailgunRegionAndSelection(t *testing.T) {
	if s := NewMailgunSender(config.MailConfig{MailgunRegion: "eu"}, ""); s.base != "https://api.eu.mailgun.net" {
		t.Fatalf("eu base = %s", s.base)
	}
	cfg := &config.Config{Mail: config.MailConfig{Provider: "mailgun", MailgunRegion: "us"}}
	cfg.SMTP.From = "X <x@mg.example.com>"
	if _, ok := NewSender(cfg).(*MailgunSender); !ok {
		t.Fatal("mailgun provider must select the Mailgun sender")
	}
	cfg.Mail.Provider = "smtp"
	if _, ok := NewSender(cfg).(*SMTPSender); !ok {
		t.Fatal("smtp provider must select the SMTP sender")
	}
}
