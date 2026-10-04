package service

import (
	"context"
	"slices"
	"strings"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	chatevents "github.com/reliabilix/lecodekanban/backend/internal/modules/chat/events"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Page is one slice of a channel's history, oldest first within the page.
type Page struct {
	Messages []MessageView
	// HasMore says older messages exist before the first one returned.
	HasMore bool
}

// Messages returns top-level messages, newest page first; pass the oldest id you have as before.
func (s *Service) Messages(ctx context.Context, user, channel uuid.UUID, before *uuid.UUID, limit int) (Page, error) {
	if _, _, err := s.access(ctx, user, channel, false); err != nil {
		return Page{}, err
	}
	if limit <= 0 {
		limit = domain.PageSize
	}
	limit = min(limit, domain.MaxPageSize)
	ms, err := s.repo.Messages(ctx, channel, before, limit+1)
	if err != nil {
		return Page{}, err
	}
	more := len(ms) > limit
	if more {
		ms = ms[:limit]
	}
	slices.Reverse(ms)
	views, err := s.present(ctx, user, ms)
	if err != nil {
		return Page{}, err
	}
	return Page{Messages: views, HasMore: more}, nil
}

// Thread returns a message and its replies, oldest first (the root is first).
func (s *Service) Thread(ctx context.Context, user, root uuid.UUID) ([]MessageView, error) {
	m, err := s.repo.Message(ctx, root)
	if err != nil {
		return nil, err
	}
	if _, _, err := s.access(ctx, user, m.ChannelID, false); err != nil {
		return nil, err
	}
	if m.ParentID != nil {
		return nil, apperr.New(domain.ErrNotFound, "not found")
	}
	replies, err := s.repo.Replies(ctx, root)
	if err != nil {
		return nil, err
	}
	return s.present(ctx, user, append([]domain.Message{m}, replies...))
}

// Post sends a message, or a reply when parent is set. Posting in a public channel joins it.
func (s *Service) Post(ctx context.Context, user, channel uuid.UUID, parent *uuid.UUID, body string, fileIDs []uuid.UUID) (MessageView, error) {
	ch, member, err := s.access(ctx, user, channel, true)
	if err != nil {
		return MessageView{}, err
	}
	if len(fileIDs) > domain.MaxFilesPerMessage {
		return MessageView{}, apperr.New(domain.ErrTooManyFiles, "too many files").WithMeta("max", domain.MaxFilesPerMessage)
	}
	if ch.Feed && parent == nil {
		return MessageView{}, apperr.New(domain.ErrFeedOnly, "only task updates appear in a task feed")
	}
	if err := validateBody(&body, len(fileIDs) > 0); err != nil {
		return MessageView{}, err
	}
	if parent != nil {
		p, err := s.repo.Message(ctx, *parent)
		if err != nil || p.ChannelID != ch.ID {
			return MessageView{}, apperr.New(domain.ErrNotFound, "not found")
		}
		if p.ParentID != nil {
			return MessageView{}, apperr.New(domain.ErrThreadDeep, "threads are one level deep")
		}
		if p.Deleted() {
			return MessageView{}, apperr.New(domain.ErrDeleted, "message was deleted")
		}
	}
	if domain.MentionsAll(body) {
		if _, err := s.ws.Authorize(ctx, ch.WorkspaceID, user, wsdomain.PermBroadcast); err != nil {
			return MessageView{}, err
		}
	}
	mentions, err := s.members(ctx, ch.WorkspaceID, domain.ParseMentions(body))
	if err != nil {
		return MessageView{}, err
	}
	var saved domain.Message
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if !member {
			if err := r.AddMember(ctx, ch.ID, user); err != nil {
				return err
			}
		}
		m, err := r.InsertMessage(ctx, domain.Message{ChannelID: ch.ID, AuthorID: &user, ParentID: parent,
			Body: body, Mentions: mentions, MentionAll: domain.MentionsAll(body)})
		if err != nil {
			return err
		}
		saved = m
		if len(fileIDs) > 0 {
			n, err := r.AttachFiles(ctx, fileIDs, m.ID, ch.ID, user)
			if err != nil {
				return err
			}
			if n != len(fileIDs) { // somebody else's file, another channel, or already used
				return apperr.New(domain.ErrNoFile, "unknown attachment")
			}
		}
		if parent != nil {
			if err := r.AddReply(ctx, *parent, m.CreatedAt); err != nil {
				return err
			}
		}
		if err := r.TouchChannel(ctx, ch.ID, m.CreatedAt); err != nil {
			return err
		}
		// Your own message never counts as unread, and posting means you have caught up.
		return r.MarkRead(ctx, ch.ID, user)
	})
	if err != nil {
		return MessageView{}, err
	}
	s.hint(ctx, "chat.message", ch.WorkspaceID, user, ch.ID, &saved.ID)
	s.announce(ctx, ch, saved, mentions)
	return s.presentOne(ctx, user, saved)
}

func (s *Service) ownMessage(ctx context.Context, user, id uuid.UUID) (domain.Message, domain.Channel, error) {
	m, err := s.repo.Message(ctx, id)
	if err != nil {
		return domain.Message{}, domain.Channel{}, err
	}
	ch, _, err := s.access(ctx, user, m.ChannelID, true)
	if err != nil {
		return domain.Message{}, domain.Channel{}, err
	}
	return m, ch, nil
}

// Edit changes the body of the caller's own message.
func (s *Service) Edit(ctx context.Context, user, id uuid.UUID, body string) (MessageView, error) {
	m, ch, err := s.ownMessage(ctx, user, id)
	if err != nil {
		return MessageView{}, err
	}
	if m.AuthorID == nil || *m.AuthorID != user {
		return MessageView{}, apperr.New(domain.ErrForbidden, "only the author can edit")
	}
	if m.Deleted() {
		return MessageView{}, apperr.New(domain.ErrDeleted, "message was deleted")
	}
	if m.Event != nil {
		return MessageView{}, apperr.New(domain.ErrForbidden, "task updates cannot be edited")
	}
	files, err := s.repo.FilesByMessages(ctx, []uuid.UUID{id})
	if err != nil {
		return MessageView{}, err
	}
	if err := validateBody(&body, len(files[id]) > 0); err != nil {
		return MessageView{}, err
	}
	mentions, err := s.members(ctx, ch.WorkspaceID, domain.ParseMentions(body))
	if err != nil {
		return MessageView{}, err
	}
	updated, err := s.repo.UpdateMessage(ctx, id, body, mentions, domain.MentionsAll(body))
	if err != nil {
		return MessageView{}, err
	}
	s.hint(ctx, "chat.message", ch.WorkspaceID, user, ch.ID, &id)
	return s.presentOne(ctx, user, updated)
}

// Delete removes a message (the thread of replies stays, with a tombstone in its place). The
// author or a workspace admin may delete.
func (s *Service) Delete(ctx context.Context, user, id uuid.UUID) error {
	m, ch, err := s.ownMessage(ctx, user, id)
	if err != nil {
		return err
	}
	if m.Deleted() {
		return nil
	}
	if m.AuthorID == nil || *m.AuthorID != user {
		acc, err := s.ws.Authorize(ctx, ch.WorkspaceID, user, wsdomain.PermView)
		if err != nil {
			return err
		}
		if !acc.Can(wsdomain.PermChatModerate) {
			return apperr.New(domain.ErrForbidden, "only the author or an admin can delete")
		}
	}
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		if _, err := r.DeleteMessage(ctx, id); err != nil {
			return err
		}
		if m.ParentID != nil {
			return r.RemoveReply(ctx, *m.ParentID)
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.hint(ctx, "chat.message", ch.WorkspaceID, user, ch.ID, &id)
	return nil
}

// React adds (on=true) or removes the caller's reaction.
func (s *Service) React(ctx context.Context, user, id uuid.UUID, key string, on bool) (MessageView, error) {
	if !domain.ValidReaction(key) {
		return MessageView{}, apperr.New(domain.ErrBadReact, "unknown reaction")
	}
	m, ch, err := s.ownMessage(ctx, user, id)
	if err != nil {
		return MessageView{}, err
	}
	if m.Deleted() {
		return MessageView{}, apperr.New(domain.ErrDeleted, "message was deleted")
	}
	if on {
		err = s.repo.AddReaction(ctx, id, user, key)
	} else {
		err = s.repo.RemoveReaction(ctx, id, user, key)
	}
	if err != nil {
		return MessageView{}, err
	}
	s.hint(ctx, "chat.message", ch.WorkspaceID, user, ch.ID, &id)
	return s.presentOne(ctx, user, m)
}

// announce tells the notifications module whom a new message is for. Failing to do so never fails
// the post.
func (s *Service) announce(ctx context.Context, ch domain.Channel, m domain.Message, mentions []uuid.UUID) {
	if s.bus == nil || m.AuthorID == nil {
		return
	}
	author := *m.AuthorID
	members, err := s.repo.Members(ctx, ch.ID)
	if err != nil {
		return
	}
	ev := chatevents.MessagePosted{WorkspaceID: ch.WorkspaceID, ChannelID: ch.ID, MessageID: m.ID, AuthorID: author,
		ChannelKind: string(ch.Kind), ChannelName: ch.Name, RefID: ch.RefID, Excerpt: excerpt(m.Body)}
	named := map[uuid.UUID]bool{}
	for _, id := range mentions {
		if id != author && !named[id] {
			named[id] = true
			ev.Mentioned = append(ev.Mentioned, id)
		}
	}
	for _, mem := range members {
		if mem.UserID == author || named[mem.UserID] || mem.Muted {
			continue
		}
		switch {
		case mem.MentionsOnly && !m.MentionAll:
		case ch.Kind == domain.DM:
			ev.Direct = append(ev.Direct, mem.UserID)
		case m.MentionAll:
			ev.Mentioned = append(ev.Mentioned, mem.UserID)
		}
	}
	_ = s.bus.Publish(ctx, ev)
}

func excerpt(body string) string {
	body = strings.Join(strings.Fields(body), " ")
	if r := []rune(body); len(r) > 140 {
		return string(r[:140]) + "…"
	}
	return body
}
