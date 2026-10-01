// Package mailer sends transactional email through SMTP. Sending always happens
// in the background via the "mail.send" job so requests never block on SMTP.
package mailer

import (
	"context"
	"encoding/json"
	"fmt"

	gomail "github.com/wneessen/go-mail"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
)

const JobKind = "mail.send"

type Message struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Text    string `json:"text"`
	HTML    string `json:"html"`
}

type Sender interface {
	Send(ctx context.Context, m Message) error
}

// Enqueue schedules m for delivery. key makes it idempotent (e.g. "verify:<user>:<token-id>").
func Enqueue(ctx context.Context, db jobs.DBTX, m Message, key string) error {
	return jobs.Enqueue(ctx, db, JobKind, m, jobs.EnqueueOptions{Key: key, MaxAttempts: 10})
}

// JobHandler adapts a Sender to the job queue.
func JobHandler(s Sender) jobs.Handler {
	return func(ctx context.Context, payload json.RawMessage) error {
		var m Message
		if err := json.Unmarshal(payload, &m); err != nil {
			return jobs.Permanent{Err: err}
		}
		return s.Send(ctx, m)
	}
}

type SMTPSender struct {
	cfg config.SMTPConfig
}

func NewSMTPSender(cfg config.SMTPConfig) *SMTPSender { return &SMTPSender{cfg: cfg} }

func (s *SMTPSender) Send(ctx context.Context, m Message) error {
	msg := gomail.NewMsg()
	if err := msg.From(s.cfg.From); err != nil {
		return jobs.Permanent{Err: fmt.Errorf("mailer: from: %w", err)}
	}
	if err := msg.To(m.To); err != nil {
		return jobs.Permanent{Err: fmt.Errorf("mailer: to: %w", err)}
	}
	msg.Subject(m.Subject)
	msg.SetBodyString(gomail.TypeTextPlain, m.Text)
	if m.HTML != "" {
		msg.AddAlternativeString(gomail.TypeTextHTML, m.HTML)
	}

	opts := []gomail.Option{gomail.WithPort(s.cfg.Port)}
	switch s.cfg.TLS {
	case "tls":
		opts = append(opts, gomail.WithSSL())
	case "starttls":
		opts = append(opts, gomail.WithTLSPolicy(gomail.TLSMandatory))
	default:
		opts = append(opts, gomail.WithTLSPolicy(gomail.NoTLS))
	}
	if s.cfg.Username != "" {
		opts = append(opts, gomail.WithSMTPAuth(gomail.SMTPAuthPlain),
			gomail.WithUsername(s.cfg.Username), gomail.WithPassword(s.cfg.Password))
	}
	client, err := gomail.NewClient(s.cfg.Host, opts...)
	if err != nil {
		return fmt.Errorf("mailer: client: %w", err)
	}
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("mailer: send: %w", err)
	}
	return nil
}
