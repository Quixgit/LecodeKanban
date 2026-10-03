package mailer

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/config"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/jobs"
)

// NewSender picks the delivery method from configuration.
func NewSender(cfg *config.Config) Sender {
	if cfg.Mail.Provider == "mailgun" {
		from := cfg.Mail.MailgunFrom
		if from == "" {
			from = cfg.SMTP.From
		}
		return NewMailgunSender(cfg.Mail, from)
	}
	return NewSMTPSender(cfg.SMTP)
}

// MailgunSender delivers through the Mailgun HTTP API.
type MailgunSender struct {
	cfg    config.MailConfig
	from   string
	client *http.Client
	// base is the API root; tests point it at an httptest server.
	base string
}

func NewMailgunSender(cfg config.MailConfig, from string) *MailgunSender {
	base := "https://api.mailgun.net"
	if cfg.MailgunRegion == "eu" {
		base = "https://api.eu.mailgun.net"
	}
	return &MailgunSender{cfg: cfg, from: from, base: base, client: &http.Client{Timeout: 15 * time.Second}}
}

// Send posts the message. Rejections that retrying cannot fix (bad key, unverified domain,
// invalid recipient) are permanent; rate limits, server errors and network failures are retried
// by the job queue.
func (s *MailgunSender) Send(ctx context.Context, m Message) error {
	form := url.Values{"from": {s.from}, "to": {m.To}, "subject": {m.Subject}, "text": {m.Text}}
	if m.HTML != "" {
		form.Set("html", m.HTML)
	}
	endpoint := fmt.Sprintf("%s/v3/%s/messages", s.base, url.PathEscape(s.cfg.MailgunDomain))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return jobs.Permanent{Err: fmt.Errorf("mailer: mailgun request: %w", err)}
	}
	req.SetBasicAuth("api", s.cfg.MailgunAPIKey)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("mailer: mailgun: %w", err)
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
	switch {
	case res.StatusCode/100 == 2:
		return nil
	case res.StatusCode == http.StatusTooManyRequests || res.StatusCode/100 == 5:
		return fmt.Errorf("mailer: mailgun %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	default:
		return jobs.Permanent{Err: fmt.Errorf("mailer: mailgun %d: %s", res.StatusCode, strings.TrimSpace(string(body)))}
	}
}
