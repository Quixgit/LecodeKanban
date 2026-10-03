// Package repository persists chat channels, members, messages and reactions.
package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/chat/repository/store"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/db"
)

type Repo struct {
	pool *pgxpool.Pool
	q    *store.Queries
}

func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool, q: store.New(pool)} }

func (r *Repo) InTx(ctx context.Context, fn func(*Repo) error) error {
	return db.WithTx(ctx, r.pool, func(tx pgx.Tx) error { return fn(&Repo{pool: r.pool, q: r.q.WithTx(tx)}) })
}

func nullID(id *uuid.UUID) uuid.NullUUID {
	if id == nil {
		return uuid.NullUUID{}
	}
	return uuid.NullUUID{UUID: *id, Valid: true}
}

func ptrID(n uuid.NullUUID) *uuid.UUID {
	if !n.Valid {
		return nil
	}
	id := n.UUID
	return &id
}

func str(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func optStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func toChannel(c store.ChatChannel) domain.Channel {
	return domain.Channel{ID: c.ID, WorkspaceID: c.WorkspaceID, Kind: domain.Kind(c.Kind), Name: str(c.Name),
		Topic: c.Topic, DMKey: str(c.DmKey), CreatedBy: ptrID(c.CreatedBy), CreatedAt: c.CreatedAt,
		LastMessageAt: c.LastMessageAt}
}

func toMessage(m store.ChatMessage) domain.Message {
	return domain.Message{ID: m.ID, ChannelID: m.ChannelID, AuthorID: ptrID(m.AuthorID), ParentID: ptrID(m.ParentID),
		Body: m.Body, Mentions: m.Mentions, ReplyCount: int(m.ReplyCount), LastReplyAt: m.LastReplyAt,
		CreatedAt: m.CreatedAt, EditedAt: m.EditedAt, DeletedAt: m.DeletedAt}
}

func toMembership(m store.ChatMember) domain.Membership {
	return domain.Membership{ChannelID: m.ChannelID, UserID: m.UserID, JoinedAt: m.JoinedAt,
		LastReadAt: m.LastReadAt, Muted: m.Muted}
}

func notFound(err error) error {
	if db.IsNoRows(err) {
		return apperr.New(domain.ErrNotFound, "not found")
	}
	return err
}

// --- channels

func (r *Repo) CreateChannel(ctx context.Context, c domain.Channel) (domain.Channel, error) {
	row, err := r.q.CreateChannel(ctx, store.CreateChannelParams{WorkspaceID: c.WorkspaceID, Kind: string(c.Kind),
		Name: optStr(c.Name), Topic: c.Topic, DmKey: optStr(c.DMKey), CreatedBy: nullID(c.CreatedBy)})
	if err != nil {
		if db.IsUniqueViolation(err, "chat_channels_name_key") {
			return domain.Channel{}, apperr.New(domain.ErrNameTaken, "channel name taken")
		}
		return domain.Channel{}, err
	}
	return toChannel(row), nil
}

func (r *Repo) Channel(ctx context.Context, id uuid.UUID) (domain.Channel, error) {
	row, err := r.q.GetChannel(ctx, id)
	if err != nil {
		return domain.Channel{}, notFound(err)
	}
	return toChannel(row), nil
}

// DMChannel returns the conversation for a participant key, or ErrNotFound.
func (r *Repo) DMChannel(ctx context.Context, ws uuid.UUID, key string) (domain.Channel, error) {
	row, err := r.q.GetDMChannel(ctx, store.GetDMChannelParams{WorkspaceID: ws, DmKey: &key})
	if err != nil {
		return domain.Channel{}, notFound(err)
	}
	return toChannel(row), nil
}

func (r *Repo) UpdateChannel(ctx context.Context, id uuid.UUID, name, topic string) (domain.Channel, error) {
	row, err := r.q.UpdateChannel(ctx, store.UpdateChannelParams{ID: id, Name: optStr(name), Topic: topic})
	if err != nil {
		if db.IsUniqueViolation(err, "chat_channels_name_key") {
			return domain.Channel{}, apperr.New(domain.ErrNameTaken, "channel name taken")
		}
		return domain.Channel{}, notFound(err)
	}
	return toChannel(row), nil
}

func (r *Repo) ArchiveChannel(ctx context.Context, id uuid.UUID) error {
	return r.q.ArchiveChannel(ctx, id)
}

func (r *Repo) TouchChannel(ctx context.Context, id uuid.UUID, at time.Time) error {
	return r.q.TouchChannel(ctx, store.TouchChannelParams{ID: id, LastMessageAt: &at})
}

// ChannelStates lists the channels a user can see, with their unread and mention counts.
func (r *Repo) ChannelStates(ctx context.Context, ws, user uuid.UUID) ([]domain.ChannelState, error) {
	rows, err := r.q.ListChannelStates(ctx, store.ListChannelStatesParams{WorkspaceID: ws, UserID: user})
	if err != nil {
		return nil, err
	}
	out := make([]domain.ChannelState, len(rows))
	for i, c := range rows {
		out[i] = domain.ChannelState{
			Channel: domain.Channel{ID: c.ID, WorkspaceID: c.WorkspaceID, Kind: domain.Kind(c.Kind), Name: str(c.Name),
				Topic: c.Topic, DMKey: str(c.DmKey), CreatedBy: ptrID(c.CreatedBy), CreatedAt: c.CreatedAt,
				LastMessageAt: c.LastMessageAt},
			Joined: c.Joined, Muted: c.Muted, Unread: int(c.Unread), Mentions: int(c.Mentions)}
	}
	return out, nil
}

// --- members

func (r *Repo) AddMember(ctx context.Context, channel, user uuid.UUID) error {
	return r.q.AddMember(ctx, store.AddMemberParams{ChannelID: channel, UserID: user})
}

func (r *Repo) RemoveMember(ctx context.Context, channel, user uuid.UUID) error {
	return r.q.RemoveMember(ctx, store.RemoveMemberParams{ChannelID: channel, UserID: user})
}

// Membership returns the user's membership, or ErrNotMember.
func (r *Repo) Membership(ctx context.Context, channel, user uuid.UUID) (domain.Membership, error) {
	row, err := r.q.GetMembership(ctx, store.GetMembershipParams{ChannelID: channel, UserID: user})
	if err != nil {
		if db.IsNoRows(err) {
			return domain.Membership{}, apperr.New(domain.ErrNotMember, "not a member")
		}
		return domain.Membership{}, err
	}
	return toMembership(row), nil
}

func (r *Repo) Members(ctx context.Context, channel uuid.UUID) ([]domain.Membership, error) {
	rows, err := r.q.ListMembers(ctx, channel)
	if err != nil {
		return nil, err
	}
	out := make([]domain.Membership, len(rows))
	for i, m := range rows {
		out[i] = toMembership(m)
	}
	return out, nil
}

// MembersOf returns the memberships of several channels, grouped by channel.
func (r *Repo) MembersOf(ctx context.Context, channels []uuid.UUID) (map[uuid.UUID][]domain.Membership, error) {
	rows, err := r.q.ListMembersOf(ctx, channels)
	if err != nil {
		return nil, err
	}
	out := map[uuid.UUID][]domain.Membership{}
	for _, m := range rows {
		out[m.ChannelID] = append(out[m.ChannelID], toMembership(m))
	}
	return out, nil
}

func (r *Repo) MarkRead(ctx context.Context, channel, user uuid.UUID) error {
	return r.q.MarkRead(ctx, store.MarkReadParams{ChannelID: channel, UserID: user})
}

func (r *Repo) SetMuted(ctx context.Context, channel, user uuid.UUID, muted bool) error {
	return r.q.SetMuted(ctx, store.SetMutedParams{ChannelID: channel, UserID: user, Muted: muted})
}

// --- messages

func (r *Repo) InsertMessage(ctx context.Context, m domain.Message) (domain.Message, error) {
	row, err := r.q.InsertMessage(ctx, store.InsertMessageParams{ChannelID: m.ChannelID, AuthorID: nullID(m.AuthorID),
		ParentID: nullID(m.ParentID), Body: m.Body, Mentions: nonNil(m.Mentions)})
	if err != nil {
		return domain.Message{}, err
	}
	return toMessage(row), nil
}

func nonNil(ids []uuid.UUID) []uuid.UUID {
	if ids == nil {
		return []uuid.UUID{}
	}
	return ids
}

func (r *Repo) Message(ctx context.Context, id uuid.UUID) (domain.Message, error) {
	row, err := r.q.GetMessage(ctx, id)
	if err != nil {
		return domain.Message{}, notFound(err)
	}
	return toMessage(row), nil
}

// Messages returns a page of top-level messages, newest first, older than the cursor message.
func (r *Repo) Messages(ctx context.Context, channel uuid.UUID, before *uuid.UUID, limit int) ([]domain.Message, error) {
	rows, err := r.q.ListMessages(ctx, store.ListMessagesParams{ChannelID: channel, BeforeID: nullID(before),
		Lim: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Message, len(rows))
	for i, m := range rows {
		out[i] = toMessage(m)
	}
	return out, nil
}

func (r *Repo) Replies(ctx context.Context, parent uuid.UUID) ([]domain.Message, error) {
	rows, err := r.q.ListReplies(ctx, uuid.NullUUID{UUID: parent, Valid: true})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Message, len(rows))
	for i, m := range rows {
		out[i] = toMessage(m)
	}
	return out, nil
}

func (r *Repo) AddReply(ctx context.Context, parent uuid.UUID, at time.Time) error {
	return r.q.AddReply(ctx, store.AddReplyParams{ID: parent, LastReplyAt: &at})
}

func (r *Repo) RemoveReply(ctx context.Context, parent uuid.UUID) error {
	return r.q.RemoveReply(ctx, parent)
}

func (r *Repo) UpdateMessage(ctx context.Context, id uuid.UUID, body string, mentions []uuid.UUID) (domain.Message, error) {
	row, err := r.q.UpdateMessage(ctx, store.UpdateMessageParams{ID: id, Body: body, Mentions: nonNil(mentions)})
	if err != nil {
		return domain.Message{}, notFound(err)
	}
	return toMessage(row), nil
}

func (r *Repo) DeleteMessage(ctx context.Context, id uuid.UUID) (domain.Message, error) {
	row, err := r.q.DeleteMessage(ctx, id)
	if err != nil {
		return domain.Message{}, notFound(err)
	}
	return toMessage(row), nil
}

// --- reactions

func (r *Repo) AddReaction(ctx context.Context, message, user uuid.UUID, key string) error {
	return r.q.AddReaction(ctx, store.AddReactionParams{MessageID: message, UserID: user, Key: key})
}

func (r *Repo) RemoveReaction(ctx context.Context, message, user uuid.UUID, key string) error {
	return r.q.RemoveReaction(ctx, store.RemoveReactionParams{MessageID: message, UserID: user, Key: key})
}

// Reactions summarises reactions per message for the viewer.
func (r *Repo) Reactions(ctx context.Context, messages []uuid.UUID, viewer uuid.UUID) (map[uuid.UUID][]domain.ReactionCount, error) {
	out := map[uuid.UUID][]domain.ReactionCount{}
	if len(messages) == 0 {
		return out, nil
	}
	rows, err := r.q.ListReactions(ctx, messages)
	if err != nil {
		return nil, err
	}
	for _, x := range rows {
		list := out[x.MessageID]
		idx := -1
		for i := range list {
			if list[i].Key == x.Key {
				idx = i
				break
			}
		}
		if idx < 0 {
			list = append(list, domain.ReactionCount{Key: x.Key})
			idx = len(list) - 1
		}
		list[idx].Count++
		list[idx].Users = append(list[idx].Users, x.UserID)
		if x.UserID == viewer {
			list[idx].Mine = true
		}
		out[x.MessageID] = list
	}
	return out, nil
}
