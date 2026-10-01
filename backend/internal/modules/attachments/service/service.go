// Package service implements attachment use cases; authorisation follows the card (cards module).
package service

import (
	"bufio"
	"context"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/repository"
	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/logger"
)

type Cards interface {
	Ref(ctx context.Context, user, card uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Role, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

type Service struct {
	repo     *repository.Repo
	store    domain.Storage
	cards    Cards
	ws       Workspaces
	users    Users
	bus      *eventbus.Bus
	maxBytes int64
}

func New(repo *repository.Repo, store domain.Storage, cards Cards, ws Workspaces, users Users, bus *eventbus.Bus, maxBytes int64) *Service {
	return &Service{repo: repo, store: store, cards: cards, ws: ws, users: users, bus: bus, maxBytes: maxBytes}
}

func (s *Service) MaxBytes() int64 { return s.maxBytes }

// View is an attachment with its uploader resolved.
type View struct {
	domain.Attachment
	Uploader *usersdomain.User
}

func (s *Service) present(ctx context.Context, as []domain.Attachment) ([]View, error) {
	ids := []uuid.UUID{}
	for _, a := range as {
		if a.UploadedBy != nil {
			ids = append(ids, *a.UploadedBy)
		}
	}
	people := map[uuid.UUID]usersdomain.User{}
	if len(ids) > 0 {
		us, err := s.users.GetMany(ctx, ids)
		if err != nil {
			return nil, err
		}
		for _, u := range us {
			people[u.ID] = u
		}
	}
	out := make([]View, len(as))
	for i, a := range as {
		out[i] = View{Attachment: a}
		if a.UploadedBy != nil {
			if u, ok := people[*a.UploadedBy]; ok {
				out[i].Uploader = &u
			}
		}
	}
	return out, nil
}

func (s *Service) List(ctx context.Context, user, card uuid.UUID) ([]View, error) {
	if _, err := s.cards.Ref(ctx, user, card, wsdomain.PermView); err != nil {
		return nil, err
	}
	as, err := s.repo.List(ctx, card)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, as)
}

// SanitizeName keeps a display-safe base name: no paths, no control characters, ≤255 bytes.
func SanitizeName(name string) string {
	name = path.Base(strings.ReplaceAll(name, `\`, "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == '"' {
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	for len(name) > 255 {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	if name == "" || name == "." || name == "/" {
		return "file"
	}
	return name
}

func evAttachment(a domain.Attachment, card carddomain.Ref, actor uuid.UUID, count int) events.Attachment {
	return events.Attachment{AttachmentID: a.ID, CardID: card.ID, ProjectID: card.ProjectID, WorkspaceID: card.WorkspaceID,
		ActorID: actor, CardNumber: card.Number, CardTitle: card.Title, Name: a.Name, Count: count}
}

// Upload stores a file on a card. The content type is sniffed, never taken from the client.
func (s *Service) Upload(ctx context.Context, user, cardID uuid.UUID, name string, body io.Reader) (View, error) {
	card, err := s.cards.Ref(ctx, user, cardID, wsdomain.PermEditContent)
	if err != nil {
		return View{}, err
	}
	n, err := s.repo.Count(ctx, cardID)
	if err != nil {
		return View{}, err
	}
	if n >= domain.MaxPerCard {
		return View{}, apperr.New(domain.ErrTooMany, "too many attachments on this card").WithMeta("max", domain.MaxPerCard)
	}
	br := bufio.NewReaderSize(body, 512)
	head, _ := br.Peek(512)
	ctype := http.DetectContentType(head)
	id := uuid.New()
	key := id.String()[:2] + "/" + id.String()
	size, err := s.store.Put(ctx, key, br, s.maxBytes)
	if err != nil {
		return View{}, err
	}
	a, err := s.repo.Create(ctx, domain.Attachment{WorkspaceID: card.WorkspaceID, CardID: cardID, Name: SanitizeName(name),
		ContentType: ctype, Size: size, StorageKey: key, UploadedBy: &user})
	if err != nil {
		_ = s.store.Delete(ctx, key)
		return View{}, err
	}
	count, err := s.repo.Count(ctx, cardID)
	if err != nil {
		return View{}, err
	}
	_ = s.bus.Publish(ctx, events.AttachmentAdded{Attachment: evAttachment(a, card, user, count)})
	v, err := s.present(ctx, []domain.Attachment{a})
	if err != nil {
		return View{}, err
	}
	return v[0], nil
}

func (s *Service) load(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (domain.Attachment, carddomain.Ref, error) {
	a, err := s.repo.Get(ctx, id)
	if err != nil {
		return domain.Attachment{}, carddomain.Ref{}, err
	}
	card, err := s.cards.Ref(ctx, user, a.CardID, perm)
	if apperr.IsCode(err, carddomain.ErrNotFound) {
		return domain.Attachment{}, carddomain.Ref{}, apperr.New(domain.ErrNotFound, "attachment not found")
	}
	return a, card, err
}

// Open returns an attachment's metadata and bytes for download.
func (s *Service) Open(ctx context.Context, user, id uuid.UUID) (domain.Attachment, io.ReadSeekCloser, error) {
	a, _, err := s.load(ctx, user, id, wsdomain.PermView)
	if err != nil {
		return domain.Attachment{}, nil, err
	}
	f, err := s.store.Open(ctx, a.StorageKey)
	if err != nil {
		return domain.Attachment{}, nil, err
	}
	return a, f, nil
}

// Delete removes an attachment: its uploader, or a workspace admin/owner.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	a, card, err := s.load(ctx, user, id, wsdomain.PermEditContent)
	if err != nil {
		return err
	}
	if a.UploadedBy == nil || *a.UploadedBy != user {
		role, err := s.ws.Authorize(ctx, card.WorkspaceID, user, wsdomain.PermEditContent)
		if err != nil {
			return err
		}
		if !role.AtLeast(wsdomain.RoleAdmin) {
			return apperr.New(domain.ErrForbidden, "only the uploader or an admin can delete an attachment")
		}
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return err
	}
	if err := s.store.Delete(ctx, a.StorageKey); err != nil {
		// Metadata is gone; an orphaned file is harmless and logged for cleanup.
		logger.From(ctx).Warn("attachment file not deleted", slog.String("key", a.StorageKey), slog.Any("err", err))
	}
	count, err := s.repo.Count(ctx, a.CardID)
	if err != nil {
		return err
	}
	_ = s.bus.Publish(ctx, events.AttachmentRemoved{Attachment: evAttachment(a, card, user, count)})
	return nil
}
