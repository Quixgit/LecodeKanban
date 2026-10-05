// Package service implements support requests: anyone in a workspace may write to its administrators; the people with
// the support permission read them, change their status and are told by email when a new one arrives.
package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/support/repository"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/mailer"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

// MailQueue enqueues transactional email (mailer.Enqueue bound to the pool).
type MailQueue func(ctx context.Context, m mailer.Message, key string) error

type Service struct {
	repo  *repository.Repo
	ws    Workspaces
	users Users
	mail  MailQueue
	log   *slog.Logger
	now   func() time.Time
}

func New(repo *repository.Repo, ws Workspaces, users Users, mail MailQueue, log *slog.Logger) *Service {
	return &Service{repo: repo, ws: ws, users: users, mail: mail, log: log, now: time.Now}
}

// View is a request with its author.
type View struct {
	domain.Request
	Author *usersdomain.User
}

func (s *Service) present(ctx context.Context, rs []domain.Request) ([]View, error) {
	ids := make([]uuid.UUID, 0, len(rs))
	for _, r := range rs {
		ids = append(ids, r.AuthorID)
	}
	byID := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			byID[u.ID] = u
		}
	}
	out := make([]View, len(rs))
	for i, r := range rs {
		out[i] = View{Request: r}
		if u, ok := byID[r.AuthorID]; ok {
			out[i].Author = &u
		}
	}
	return out, nil
}

// Input is what a person fills in.
type Input struct {
	Kind               domain.Kind
	Subject, Message   string
	PageURL, UserAgent string
	// Screenshot is base64 (no data-URL prefix); ScreenshotType its media type.
	Screenshot, ScreenshotType string
}

var imageTypes = map[string]func([]byte) bool{
	"image/png":  func(b []byte) bool { return bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n")) },
	"image/jpeg": func(b []byte) bool { return bytes.HasPrefix(b, []byte{0xff, 0xd8, 0xff}) },
	"image/webp": func(b []byte) bool { return len(b) > 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP" },
}

// decodeShot checks that the bytes really are the image they claim to be: a browser would otherwise be asked to
// show whatever an author sent, under an administrator's session.
func decodeShot(typ, b64 string) (*domain.Screenshot, error) {
	if b64 == "" {
		return nil, nil
	}
	check, ok := imageTypes[typ]
	if !ok {
		return nil, apperr.New(domain.ErrImage, "unsupported image type")
	}
	if base64.StdEncoding.DecodedLen(len(b64)) > domain.MaxScreenshotSize+4 {
		return nil, apperr.New(domain.ErrImage, "screenshot is too large").WithMeta("maxBytes", domain.MaxScreenshotSize)
	}
	data, err := base64.StdEncoding.DecodeString(b64)
	if err != nil || len(data) > domain.MaxScreenshotSize || !check(data) {
		return nil, apperr.New(domain.ErrImage, "screenshot is not a valid image").WithMeta("maxBytes", domain.MaxScreenshotSize)
	}
	return &domain.Screenshot{ContentType: typ, Data: data}, nil
}

func clip(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

// Create records a request and tells the people who can answer it.
func (s *Service) Create(ctx context.Context, user, ws uuid.UUID, in Input) (View, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return View{}, err
	}
	in.Subject, in.Message = strings.TrimSpace(in.Subject), strings.TrimSpace(in.Message)
	var v validation.V
	if !in.Kind.Valid() {
		v.OneOf("kind", string(in.Kind), "problem", "idea", "question")
	}
	if v.Required("subject", in.Subject) {
		v.Length("subject", in.Subject, 1, domain.MaxSubject)
	}
	if v.Required("message", in.Message) {
		v.Length("message", in.Message, 1, domain.MaxMessage)
	}
	if err := v.Err(); err != nil {
		return View{}, err
	}
	shot, err := decodeShot(in.ScreenshotType, in.Screenshot)
	if err != nil {
		return View{}, err
	}
	open, err := s.repo.CountOpen(ctx, ws, user)
	if err != nil {
		return View{}, err
	}
	if open >= domain.MaxOpenPerAuthor {
		return View{}, apperr.New(domain.ErrTooMany, "too many open requests").WithMeta("max", domain.MaxOpenPerAuthor)
	}
	r, err := s.repo.Create(ctx, domain.Request{WorkspaceID: ws, AuthorID: user, Kind: in.Kind, Subject: in.Subject, Message: in.Message,
		PageURL: clip(in.PageURL, 500), UserAgent: clip(in.UserAgent, 300)}, shot)
	if err != nil {
		return View{}, err
	}
	views, err := s.present(ctx, []domain.Request{r})
	if err != nil {
		return View{}, err
	}
	s.notify(ctx, views[0])
	return views[0], nil
}

const maxNotified = 10

// notify emails the people who manage support; a failure is logged, the request is already saved.
func (s *Service) notify(ctx context.Context, v View) {
	roles, err := s.ws.RolesByUser(ctx, v.WorkspaceID)
	if err != nil {
		s.log.Warn("support: members lookup failed", slog.Any("err", err))
		return
	}
	var managers []uuid.UUID
	for id := range roles {
		if id == v.AuthorID || len(managers) >= maxNotified {
			continue
		}
		if a, err := s.ws.Authorize(ctx, v.WorkspaceID, id, wsdomain.PermSupport); err == nil && a.Can(wsdomain.PermSupport) {
			managers = append(managers, id)
		}
	}
	if len(managers) == 0 {
		return
	}
	us, err := s.users.GetMany(ctx, managers)
	if err != nil {
		return
	}
	author := "?"
	if v.Author != nil {
		author = fmt.Sprintf("%s <%s>", v.Author.Name, v.Author.Email)
	}
	for _, u := range us {
		text := fmt.Sprintf("%s\n\n%s\n\n— %s\n%s\n", v.Subject, v.Message, author, v.PageURL)
		m := mailer.Message{To: u.Email, Subject: fmt.Sprintf("[Support · %s] %s", v.Kind, v.Subject), Text: text,
			HTML: "<pre style=\"font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap\">" + htmlEscape(text) + "</pre>"}
		if err := s.mail(ctx, m, "support:"+v.ID.String()+":"+u.ID.String()); err != nil {
			s.log.Warn("support: notification failed", slog.Any("err", err))
		}
	}
}

func htmlEscape(s string) string {
	return strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;").Replace(s)
}

// List returns the requests a person may see: all of the workspace's for a support manager, otherwise their own.
func (s *Service) List(ctx context.Context, user, ws uuid.UUID, status *domain.Status, mineOnly bool) ([]View, error) {
	access, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView)
	if err != nil {
		return nil, err
	}
	var author *uuid.UUID
	if mineOnly || !access.Can(wsdomain.PermSupport) {
		author = &user
	}
	rs, err := s.repo.List(ctx, ws, author, status)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, rs)
}

// SetStatus moves a request along (support managers only).
func (s *Service) SetStatus(ctx context.Context, user, id uuid.UUID, status domain.Status) (View, error) {
	r, err := s.repo.Get(ctx, id)
	if err != nil {
		return View{}, err
	}
	if _, err := s.ws.Authorize(ctx, r.WorkspaceID, user, wsdomain.PermSupport); err != nil {
		if apperr.IsCode(err, wsdomain.ErrNotFound) {
			return View{}, apperr.New(domain.ErrNotFound, "request not found")
		}
		return View{}, err
	}
	if !status.Valid() {
		var v validation.V
		v.OneOf("status", string(status), "new", "in_progress", "resolved")
		return View{}, v.Err()
	}
	upd, err := s.repo.SetStatus(ctx, id, status)
	if err != nil {
		return View{}, err
	}
	views, err := s.present(ctx, []domain.Request{upd})
	if err != nil {
		return View{}, err
	}
	return views[0], nil
}

// Screenshot returns the image of a request to its author or to a support manager.
func (s *Service) Screenshot(ctx context.Context, user, id uuid.UUID) (domain.Screenshot, error) {
	r, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Screenshot{}, err
	}
	access, err := s.ws.Authorize(ctx, r.WorkspaceID, user, wsdomain.PermView)
	if err != nil || (r.AuthorID != user && !access.Can(wsdomain.PermSupport)) {
		return domain.Screenshot{}, apperr.New(domain.ErrNotFound, "request not found")
	}
	return s.repo.Screenshot(ctx, id)
}
