package service

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
)

// MailInfo describes, without secrets, how this server sends email.
type MailInfo struct {
	Provider string // smtp | mailgun
	Host     string // SMTP host, or the Mailgun domain
	From     string
}

// Capturing reports whether mail is only collected in a test inbox (such as Mailpit) instead of being delivered.
func (i MailInfo) Capturing() bool {
	h := strings.ToLower(i.Host)
	return i.Provider == "smtp" && (h == "" || h == "localhost" || h == "127.0.0.1" || strings.Contains(h, "mailpit") ||
		strings.Contains(h, "mailhog") || strings.HasSuffix(strings.ToLower(i.From), ".local>") || strings.HasSuffix(strings.ToLower(i.From), ".local"))
}

// WithMailInfo tells the service how email leaves the server, for the admin's delivery page.
func (s *Service) WithMailInfo(i MailInfo) *Service {
	s.mailInfo = i
	return s
}

// MailItem is one email in the delivery list.
type MailItem struct {
	ID        int64
	Recipient string
	Subject   string
	Status    string // pending | running | done | failed
	Attempts  int
	Error     string
	At        time.Time
}

// MailStatus is the delivery page: how mail is configured, the queue, and the latest emails.
type MailStatus struct {
	Info    MailInfo
	Waiting int
	Failed  int
	Recent  []MailItem
}

// MailStatus shows administrators whether email is really being delivered.
func (s *Service) MailStatus(ctx context.Context, actor, ws uuid.UUID) (MailStatus, error) {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermUpdate); err != nil {
		return MailStatus{}, err
	}
	counts, rows, err := s.repo.MailOverview(ctx, ws)
	if err != nil {
		return MailStatus{}, err
	}
	out := MailStatus{Info: s.mailInfo, Waiting: int(counts.Waiting), Failed: int(counts.Failed)}
	for _, r := range rows {
		out.Recent = append(out.Recent, toMailItem(r))
	}
	return out, nil
}

func toMailItem(r store.ListWorkspaceMailRow) MailItem {
	return MailItem{ID: r.ID, Recipient: r.Recipient, Subject: r.Subject, Status: r.Status, Attempts: int(r.Attempts),
		Error: r.LastError, At: r.CreatedAt}
}

// SendTestMail sends a short message to the administrator's own address.
func (s *Service) SendTestMail(ctx context.Context, actor, ws uuid.UUID) error {
	if _, err := s.authorize(ctx, s.repo, ws, actor, domain.PermUpdate); err != nil {
		return err
	}
	u, err := s.users.Get(ctx, actor)
	if err != nil {
		return err
	}
	subject, text := "LecodeKanban: test email", "This is a test email from the admin centre. If you can read it, invitations and reminders will reach people too."
	if u.Locale == "uk" {
		subject, text = "LecodeKanban: тестовий лист", "Це тестовий лист із центру адміністрування. Якщо ви його читаєте, запрошення й нагадування доходитимуть і до інших."
	}
	return s.mail(ctx, mailer.Message{To: u.Email, Subject: subject, Text: text, HTML: "<p>" + text + "</p>"}, "test:"+uuid.NewString())
}
