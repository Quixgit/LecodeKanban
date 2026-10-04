// Package service implements the chat use cases. Access: every caller must be a workspace member;
// public channels can be read by anyone and joined on first post, private channels and direct
// messages answer chat.not_found to non-members so their existence is not leaked (ADR 0016).
package service

import (
	"context"
	"io"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	carddomain "github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	projectsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/projects/domain"
	usersdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/eventbus"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

type Workspaces interface {
	Authorize(ctx context.Context, ws, user uuid.UUID, perm wsdomain.Permission) (wsdomain.Access, error)
	RolesByUser(ctx context.Context, ws uuid.UUID) (map[uuid.UUID]wsdomain.Role, error)
	Policy(ctx context.Context, ws uuid.UUID) (wsdomain.Settings, error)
}

// Projects and Cards authorise access to the things a scoped conversation hangs off.
type Projects interface {
	Ref(ctx context.Context, id uuid.UUID) (projectsdomain.Ref, error)
}

type Cards interface {
	Ref(ctx context.Context, user, id uuid.UUID, perm wsdomain.Permission) (carddomain.Ref, error)
}

type Users interface {
	GetMany(ctx context.Context, ids []uuid.UUID) ([]usersdomain.User, error)
}

// Hints publishes change hints to browsers (realtime.Publisher satisfies it; nil disables them).
type Hints interface {
	Publish(ctx context.Context, m realtime.Message)
}

type Service struct {
	repo  *repository.Repo
	ws    Workspaces
	users Users
	hints Hints
	now   func() time.Time

	projects Projects
	cards    Cards

	storage  Storage
	maxBytes int64

	bus *eventbus.Bus
}

// Storage keeps attachment bytes (the local disk adapter satisfies it).
type Storage interface {
	Put(ctx context.Context, key string, r io.Reader, max int64) (int64, error)
	Open(ctx context.Context, key string) (io.ReadSeekCloser, error)
	Delete(ctx context.Context, key string) error
}

// WithFiles enables attachments up to maxBytes each.
func (s *Service) WithFiles(st Storage, maxBytes int64) *Service {
	s.storage, s.maxBytes = st, maxBytes
	return s
}

// WithBus publishes MessagePosted events for notifications.
func (s *Service) WithBus(b *eventbus.Bus) *Service {
	s.bus = b
	return s
}

// MaxUploadBytes is the per-file limit.
func (s *Service) MaxUploadBytes() int64 { return s.maxBytes }

func New(repo *repository.Repo, ws Workspaces, users Users, hints Hints) *Service {
	return &Service{repo: repo, ws: ws, users: users, hints: hints, now: time.Now}
}

// WithScopes enables project and card conversations.
func (s *Service) WithScopes(p Projects, c Cards) *Service {
	s.projects, s.cards = p, c
	return s
}

func (s *Service) hint(ctx context.Context, typ string, ws uuid.UUID, actor uuid.UUID, channel uuid.UUID, msg *uuid.UUID) {
	if s.hints == nil {
		return
	}
	s.hints.Publish(ctx, realtime.Message{Type: typ, WorkspaceID: ws, ActorID: &actor, ChannelID: &channel, MessageID: msg})
}

// access loads a channel the user may reach. Writing needs the editor role; reading private
// conversations needs membership.
func (s *Service) access(ctx context.Context, user, channel uuid.UUID, write bool) (domain.Channel, bool, error) {
	ch, err := s.repo.Channel(ctx, channel)
	if err != nil {
		return domain.Channel{}, false, err
	}
	perm := wsdomain.PermView
	if write {
		perm = wsdomain.PermEditContent
	}
	if _, err := s.ws.Authorize(ctx, ch.WorkspaceID, user, wsdomain.PermView); err != nil {
		return domain.Channel{}, false, apperr.New(domain.ErrNotFound, "not found")
	}
	if write {
		if _, err := s.ws.Authorize(ctx, ch.WorkspaceID, user, perm); err != nil {
			return domain.Channel{}, false, err
		}
	}
	_, err = s.repo.Membership(ctx, ch.ID, user)
	member := err == nil
	if err != nil && !apperr.IsCode(err, domain.ErrNotMember) {
		return domain.Channel{}, false, err
	}
	if ch.Kind != domain.Public && !ch.Kind.Scoped() && !member {
		return domain.Channel{}, false, apperr.New(domain.ErrNotFound, "not found")
	}
	return ch, member, nil
}

// --- views

type MessageView struct {
	domain.Message
	Author    *usersdomain.User
	Mentioned []usersdomain.User
	Reactions []domain.ReactionCount
	Files     []domain.File
	// Pinned and Saved are relative to the viewer for Saved; pins are shared.
	Pinned bool
	Saved  bool
	// ReplyPeople are up to three people who replied in the thread, latest first.
	ReplyPeople []usersdomain.User
}

func (s *Service) people(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]usersdomain.User, error) {
	out := map[uuid.UUID]usersdomain.User{}
	if len(ids) == 0 {
		return out, nil
	}
	us, err := s.users.GetMany(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, u := range us {
		out[u.ID] = u
	}
	return out, nil
}

func (s *Service) present(ctx context.Context, viewer uuid.UUID, ms []domain.Message) ([]MessageView, error) {
	var ids, msgIDs []uuid.UUID
	add := func(id uuid.UUID) {
		if !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	for _, m := range ms {
		msgIDs = append(msgIDs, m.ID)
		if m.AuthorID != nil {
			add(*m.AuthorID)
		}
		for _, id := range m.Mentions {
			add(id)
		}
	}
	reactions, err := s.repo.Reactions(ctx, msgIDs, viewer)
	if err != nil {
		return nil, err
	}
	files, err := s.repo.FilesByMessages(ctx, msgIDs)
	if err != nil {
		return nil, err
	}
	pins, err := s.repo.PinnedFlags(ctx, msgIDs)
	if err != nil {
		return nil, err
	}
	saved, err := s.repo.SavedFlags(ctx, viewer, msgIDs)
	if err != nil {
		return nil, err
	}
	var roots []uuid.UUID
	for _, m := range ms {
		if m.ReplyCount > 0 {
			roots = append(roots, m.ID)
		}
	}
	repliers, err := s.repo.ReplyAuthors(ctx, roots)
	if err != nil {
		return nil, err
	}
	for _, list := range repliers {
		for _, id := range list[:min(len(list), 3)] {
			add(id)
		}
	}
	people, err := s.people(ctx, ids)
	if err != nil {
		return nil, err
	}
	out := make([]MessageView, len(ms))
	for i, m := range ms {
		v := MessageView{Message: m, Mentioned: []usersdomain.User{}, Reactions: reactions[m.ID],
			Files: files[m.ID], Pinned: pins[m.ID], Saved: saved[m.ID], ReplyPeople: []usersdomain.User{}}
		if v.Files == nil {
			v.Files = []domain.File{}
		}
		for _, id := range repliers[m.ID][:min(len(repliers[m.ID]), 3)] {
			if u, ok := people[id]; ok {
				v.ReplyPeople = append(v.ReplyPeople, u)
			}
		}
		if v.Reactions == nil {
			v.Reactions = []domain.ReactionCount{}
		}
		if m.AuthorID != nil {
			if u, ok := people[*m.AuthorID]; ok {
				v.Author = &u
			}
		}
		for _, id := range m.Mentions {
			if u, ok := people[id]; ok {
				v.Mentioned = append(v.Mentioned, u)
			}
		}
		out[i] = v
	}
	return out, nil
}

func (s *Service) presentOne(ctx context.Context, viewer uuid.UUID, m domain.Message) (MessageView, error) {
	v, err := s.present(ctx, viewer, []domain.Message{m})
	if err != nil {
		return MessageView{}, err
	}
	return v[0], nil
}

// --- validation

// validateBody trims the text. A message may be empty only when it carries files.
func validateBody(body *string, hasFiles bool) error {
	*body = strings.TrimSpace(*body)
	var v validation.V
	if hasFiles && *body == "" {
		return nil
	}
	if v.Required("body", *body) && utf8.RuneCountInString(*body) > domain.MaxBodyLen {
		v.Add("body", validation.MaxLength, map[string]any{"max": domain.MaxBodyLen})
	}
	return v.Err()
}

// members keeps only the ids that belong to the workspace.
func (s *Service) members(ctx context.Context, ws uuid.UUID, ids []uuid.UUID) ([]uuid.UUID, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	roles, err := s.ws.RolesByUser(ctx, ws)
	if err != nil {
		return nil, err
	}
	var out []uuid.UUID
	for _, id := range ids {
		if _, ok := roles[id]; ok && !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out, nil
}
