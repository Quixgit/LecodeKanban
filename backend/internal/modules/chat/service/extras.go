package service

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"path"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/realtime"
)

// --- attachments

func sanitizeFileName(name string) string {
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

// UploadFile stores a file for a channel. It stays unattached until a message carries it. The
// content type is sniffed from the bytes, never taken from the client.
func (s *Service) UploadFile(ctx context.Context, user, channel uuid.UUID, name string, body io.Reader) (domain.File, error) {
	if s.storage == nil {
		return domain.File{}, apperr.New(apperr.Unavailable, "uploads are not configured")
	}
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return domain.File{}, err
	}
	if !member && ch.Kind == domain.Public {
		return domain.File{}, apperr.New(domain.ErrNotMember, "join the channel first")
	}
	br := bufio.NewReaderSize(body, 512)
	head, _ := br.Peek(512)
	ctype := http.DetectContentType(head)
	id := uuid.New()
	key := id.String()[:2] + "/" + id.String()
	size, err := s.storage.Put(ctx, key, br, s.maxBytes)
	if err != nil {
		return domain.File{}, err
	}
	f, err := s.repo.CreateFile(ctx, domain.File{WorkspaceID: ch.WorkspaceID, ChannelID: ch.ID, UploadedBy: &user,
		Name: sanitizeFileName(name), ContentType: ctype, Size: size, StorageKey: key})
	if err != nil {
		_ = s.storage.Delete(ctx, key)
		return domain.File{}, err
	}
	return f, nil
}

// OpenFile returns a file's bytes for anybody who can read its channel. Unsent uploads are visible
// to their uploader only.
func (s *Service) OpenFile(ctx context.Context, user, id uuid.UUID) (domain.File, io.ReadSeekCloser, error) {
	if s.storage == nil {
		return domain.File{}, nil, apperr.New(apperr.Unavailable, "uploads are not configured")
	}
	f, err := s.repo.File(ctx, id)
	if err != nil {
		return domain.File{}, nil, err
	}
	if _, _, err := s.access(ctx, user, f.ChannelID, false); err != nil {
		return domain.File{}, nil, apperr.New(domain.ErrNotFound, "file not found")
	}
	if f.MessageID == nil && (f.UploadedBy == nil || *f.UploadedBy != user) {
		return domain.File{}, nil, apperr.New(domain.ErrNotFound, "file not found")
	}
	rc, err := s.storage.Open(ctx, f.StorageKey)
	if err != nil {
		return domain.File{}, nil, err
	}
	return f, rc, nil
}

// ChannelFiles lists the attachments sent in a channel, newest first.
func (s *Service) ChannelFiles(ctx context.Context, user, channel uuid.UUID) ([]domain.File, error) {
	if _, _, err := s.access(ctx, user, channel, false); err != nil {
		return nil, err
	}
	return s.repo.ChannelFiles(ctx, channel, 200)
}

// --- stars, saved, pins

// Star pins a channel to the top of the caller's list.
func (s *Service) Star(ctx context.Context, user, channel uuid.UUID, on bool) error {
	if _, _, err := s.access(ctx, user, channel, false); err != nil {
		return err
	}
	return s.repo.SetStar(ctx, user, channel, on)
}

// Save puts a message in the caller's "Later" list.
func (s *Service) Save(ctx context.Context, user, message uuid.UUID, on bool) (MessageView, error) {
	m, err := s.repo.Message(ctx, message)
	if err != nil {
		return MessageView{}, err
	}
	if _, _, err := s.access(ctx, user, m.ChannelID, false); err != nil {
		return MessageView{}, err
	}
	if m.Deleted() {
		return MessageView{}, apperr.New(domain.ErrDeleted, "message was deleted")
	}
	if err := s.repo.SetSaved(ctx, user, message, on); err != nil {
		return MessageView{}, err
	}
	return s.presentOne(ctx, user, m)
}

// Pin shows a message in the channel's pinned list; any member who can post may pin.
func (s *Service) Pin(ctx context.Context, user, message uuid.UUID, on bool) (MessageView, error) {
	m, ch, err := s.ownMessage(ctx, user, message)
	if err != nil {
		return MessageView{}, err
	}
	if m.Deleted() || m.ParentID != nil {
		return MessageView{}, apperr.New(domain.ErrDeleted, "only top-level messages can be pinned")
	}
	if err := s.repo.SetPinned(ctx, message, ch.ID, user, on); err != nil {
		return MessageView{}, err
	}
	s.hint(ctx, "chat.message", ch.WorkspaceID, user, ch.ID, &message)
	return s.presentOne(ctx, user, m)
}

// Pins lists a channel's pinned messages, latest pin first.
func (s *Service) Pins(ctx context.Context, user, channel uuid.UUID) ([]MessageView, error) {
	if _, _, err := s.access(ctx, user, channel, false); err != nil {
		return nil, err
	}
	ms, err := s.repo.Pinned(ctx, channel)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, user, ms)
}

// --- cross-channel lists

// Hit is a message together with where it lives, for search, threads and saved items.
type Hit struct {
	MessageView
	Channel ChannelView
}

func (s *Service) hits(ctx context.Context, user, ws uuid.UUID, ms []domain.Message) ([]Hit, error) {
	views, err := s.present(ctx, user, ms)
	if err != nil {
		return nil, err
	}
	states, err := s.repo.ChannelStates(ctx, ws, user)
	if err != nil {
		return nil, err
	}
	byID := map[uuid.UUID]domain.ChannelState{}
	for _, c := range states {
		byID[c.ID] = c
	}
	out := make([]Hit, 0, len(views))
	cache := map[uuid.UUID]ChannelView{}
	for _, v := range views {
		cv, ok := cache[v.ChannelID]
		if !ok {
			st, known := byID[v.ChannelID]
			if !known { // project and card conversations are not in the list
				if st, err = s.repo.ChannelState(ctx, v.ChannelID, user); err != nil {
					continue
				}
			}
			vs, err := s.viewState(ctx, []domain.ChannelState{st})
			if err != nil {
				return nil, err
			}
			cv = vs[0]
			cache[v.ChannelID] = cv
		}
		out = append(out, Hit{MessageView: v, Channel: cv})
	}
	return out, nil
}

// SearchQuery is the text plus the modifiers (in:, from:, has:, is:thread, with:me, dates).
type SearchQuery struct {
	Q           string
	ChannelID   *uuid.UUID
	FromID      *uuid.UUID
	MentionsMe  bool
	HasLink     bool
	HasFile     bool
	ThreadsOnly bool
	After       *time.Time
	Before      *time.Time
}

func (q SearchQuery) filtered() bool {
	return q.ChannelID != nil || q.FromID != nil || q.MentionsMe || q.HasLink || q.HasFile || q.ThreadsOnly ||
		q.After != nil || q.Before != nil
}

// Search finds messages matching the text and modifiers in channels the caller can see. Text alone
// needs two characters; with a modifier the text may be empty ("everything from Anna in #dev").
func (s *Service) Search(ctx context.Context, user, ws uuid.UUID, in SearchQuery) ([]Hit, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	in.Q = strings.TrimSpace(in.Q)
	if utf8.RuneCountInString(in.Q) > 100 {
		in.Q = string([]rune(in.Q)[:100])
	}
	if utf8.RuneCountInString(in.Q) < 2 && (in.Q != "" || !in.filtered()) {
		return []Hit{}, nil
	}
	ms, err := s.repo.Search(ctx, ws, user, repository.SearchFilter(in), 40)
	if err != nil {
		return nil, err
	}
	return s.hits(ctx, user, ws, ms)
}

// Saved lists the caller's "Later" messages, newest saved first.
func (s *Service) Saved(ctx context.Context, user, ws uuid.UUID) ([]Hit, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	ms, err := s.repo.Saved(ctx, ws, user, 100)
	if err != nil {
		return nil, err
	}
	return s.hits(ctx, user, ws, ms)
}

// Threads lists conversations the caller started or replied in, most recently active first.
func (s *Service) Threads(ctx context.Context, user, ws uuid.UUID) ([]Hit, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	ms, err := s.repo.MyThreads(ctx, ws, user, 50)
	if err != nil {
		return nil, err
	}
	return s.hits(ctx, user, ws, ms)
}

// --- presence and typing

// Heartbeat records that the caller has the app open.
func (s *Service) Heartbeat(ctx context.Context, user, ws uuid.UUID) error {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return err
	}
	return s.repo.TouchPresence(ctx, user)
}

// Online lists workspace members seen in the last two minutes.
func (s *Service) Online(ctx context.Context, user, ws uuid.UUID) ([]uuid.UUID, error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermView); err != nil {
		return nil, err
	}
	return s.repo.Online(ctx, ws)
}

// Typing tells the others in a channel that the caller is writing. Nothing is stored.
func (s *Service) Typing(ctx context.Context, user, channel uuid.UUID) error {
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return err
	}
	if !member {
		return nil
	}
	if s.hints != nil {
		s.hints.Publish(ctx, realtime.Message{Type: "chat.typing", WorkspaceID: ch.WorkspaceID, ActorID: &user, ChannelID: &ch.ID})
	}
	return nil
}
