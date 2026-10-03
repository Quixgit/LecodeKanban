// Package repository persists chat channels, members, messages and reactions.
package repository

import (
	"context"
	"strings"
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
		Topic: c.Topic, DMKey: str(c.DmKey), RefID: ptrID(c.RefID), Feed: c.Feed, FeedProjectID: ptrID(c.FeedProjectID), CreatedBy: ptrID(c.CreatedBy), CreatedAt: c.CreatedAt,
		LastMessageAt: c.LastMessageAt}
}

func toMessage(m store.ChatMessage) domain.Message {
	return domain.Message{ID: m.ID, ChannelID: m.ChannelID, AuthorID: ptrID(m.AuthorID), ParentID: ptrID(m.ParentID),
		Body: m.Body, Mentions: m.Mentions, MentionAll: m.MentionAll, Event: m.Event, ReplyCount: int(m.ReplyCount), LastReplyAt: m.LastReplyAt,
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
		Name: optStr(c.Name), Topic: c.Topic, DmKey: optStr(c.DMKey), CreatedBy: nullID(c.CreatedBy), RefID: nullID(c.RefID), Feed: c.Feed, FeedProjectID: nullID(c.FeedProjectID)})
	if err != nil {
		if db.IsUniqueViolation(err, "chat_channels_name_key") {
			return domain.Channel{}, apperr.New(domain.ErrNameTaken, "channel name taken")
		}
		if db.IsUniqueViolation(err, "chat_channels_ref_key") {
			return domain.Channel{}, apperr.New(domain.ErrNameTaken, "conversation exists")
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

// ScopeChannel returns the conversation of a project or card, or ErrNotFound.
func (r *Repo) ScopeChannel(ctx context.Context, kind domain.Kind, ref uuid.UUID) (domain.Channel, error) {
	row, err := r.q.GetScopeChannel(ctx, store.GetScopeChannelParams{Kind: string(kind), RefID: uuid.NullUUID{UUID: ref, Valid: true}})
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
				Topic: c.Topic, DMKey: str(c.DmKey), Feed: c.Feed, FeedProjectID: ptrID(c.FeedProjectID), CreatedBy: ptrID(c.CreatedBy), CreatedAt: c.CreatedAt,
				LastMessageAt: c.LastMessageAt},
			Joined: c.Joined, Muted: c.Muted, Starred: c.Starred, Unread: int(c.Unread), Mentions: int(c.Mentions)}
	}
	return out, nil
}

// ChannelState returns one channel as the user sees it.
func (r *Repo) ChannelState(ctx context.Context, id, user uuid.UUID) (domain.ChannelState, error) {
	c, err := r.q.GetChannelState(ctx, store.GetChannelStateParams{ID: id, UserID: user})
	if err != nil {
		return domain.ChannelState{}, notFound(err)
	}
	return domain.ChannelState{
		Channel: domain.Channel{ID: c.ID, WorkspaceID: c.WorkspaceID, Kind: domain.Kind(c.Kind), Name: str(c.Name),
			Topic: c.Topic, DMKey: str(c.DmKey), RefID: ptrID(c.RefID), Feed: c.Feed, FeedProjectID: ptrID(c.FeedProjectID), CreatedBy: ptrID(c.CreatedBy),
			CreatedAt: c.CreatedAt, LastMessageAt: c.LastMessageAt},
		Joined: c.Joined, Muted: c.Muted, Starred: c.Starred, Unread: int(c.Unread), Mentions: int(c.Mentions)}, nil
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
		ParentID: nullID(m.ParentID), Body: m.Body, Mentions: nonNil(m.Mentions), MentionAll: m.MentionAll})
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

func (r *Repo) UpdateMessage(ctx context.Context, id uuid.UUID, body string, mentions []uuid.UUID, all bool) (domain.Message, error) {
	row, err := r.q.UpdateMessage(ctx, store.UpdateMessageParams{ID: id, Body: body, Mentions: nonNil(mentions), MentionAll: all})
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

// --- files

func toFile(f store.ChatFile) domain.File {
	return domain.File{ID: f.ID, WorkspaceID: f.WorkspaceID, ChannelID: f.ChannelID, MessageID: ptrID(f.MessageID),
		UploadedBy: ptrID(f.UploadedBy), Name: f.Name, ContentType: f.ContentType, Size: f.Size,
		StorageKey: f.StorageKey, CreatedAt: f.CreatedAt}
}

func (r *Repo) CreateFile(ctx context.Context, f domain.File) (domain.File, error) {
	row, err := r.q.CreateFile(ctx, store.CreateFileParams{WorkspaceID: f.WorkspaceID, ChannelID: f.ChannelID,
		UploadedBy: nullID(f.UploadedBy), Name: f.Name, ContentType: f.ContentType, Size: f.Size, StorageKey: f.StorageKey})
	if err != nil {
		return domain.File{}, err
	}
	return toFile(row), nil
}

func (r *Repo) File(ctx context.Context, id uuid.UUID) (domain.File, error) {
	row, err := r.q.GetFile(ctx, id)
	if err != nil {
		return domain.File{}, notFound(err)
	}
	return toFile(row), nil
}

// AttachFiles binds the user's own unattached uploads of a channel to a message and returns how many.
func (r *Repo) AttachFiles(ctx context.Context, ids []uuid.UUID, message, channel, user uuid.UUID) (int, error) {
	got, err := r.q.AttachFiles(ctx, store.AttachFilesParams{MessageID: uuid.NullUUID{UUID: message, Valid: true},
		Ids: ids, ChannelID: channel, UserID: nullID(&user)})
	return len(got), err
}

func (r *Repo) FilesByMessages(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID][]domain.File, error) {
	out := map[uuid.UUID][]domain.File{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.q.ListFilesByMessages(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, f := range rows {
		if f.MessageID.Valid {
			out[f.MessageID.UUID] = append(out[f.MessageID.UUID], toFile(f))
		}
	}
	return out, nil
}

func (r *Repo) ChannelFiles(ctx context.Context, channel uuid.UUID, limit int) ([]domain.File, error) {
	rows, err := r.q.ListChannelFiles(ctx, store.ListChannelFilesParams{ChannelID: channel, Limit: int32(limit)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.File, len(rows))
	for i, f := range rows {
		out[i] = toFile(f)
	}
	return out, nil
}

// --- stars, saved, pins

func (r *Repo) SetStar(ctx context.Context, user, channel uuid.UUID, on bool) error {
	if on {
		return r.q.Star(ctx, store.StarParams{UserID: user, ChannelID: channel})
	}
	return r.q.Unstar(ctx, store.UnstarParams{UserID: user, ChannelID: channel})
}

func (r *Repo) SetSaved(ctx context.Context, user, message uuid.UUID, on bool) error {
	if on {
		return r.q.Save(ctx, store.SaveParams{UserID: user, MessageID: message})
	}
	return r.q.Unsave(ctx, store.UnsaveParams{UserID: user, MessageID: message})
}

func (r *Repo) SavedFlags(ctx context.Context, user uuid.UUID, ids []uuid.UUID) (map[uuid.UUID]bool, error) {
	out := map[uuid.UUID]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.q.ListSavedFlags(ctx, store.ListSavedFlagsParams{UserID: user, Ids: ids})
	for _, id := range rows {
		out[id] = true
	}
	return out, err
}

func (r *Repo) SetPinned(ctx context.Context, message, channel, user uuid.UUID, on bool) error {
	if on {
		return r.q.Pin(ctx, store.PinParams{MessageID: message, ChannelID: channel, PinnedBy: nullID(&user)})
	}
	return r.q.Unpin(ctx, message)
}

func (r *Repo) PinnedFlags(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]bool, error) {
	out := map[uuid.UUID]bool{}
	if len(ids) == 0 {
		return out, nil
	}
	rows, err := r.q.ListPinnedFlags(ctx, ids)
	for _, id := range rows {
		out[id] = true
	}
	return out, err
}

func (r *Repo) Pinned(ctx context.Context, channel uuid.UUID) ([]domain.Message, error) {
	rows, err := r.q.ListPinnedMessages(ctx, channel)
	if err != nil {
		return nil, err
	}
	return toMessages(rows), nil
}

func toMessages(rows []store.ChatMessage) []domain.Message {
	out := make([]domain.Message, len(rows))
	for i, m := range rows {
		out[i] = toMessage(m)
	}
	return out
}

// ReplyAuthors lists, per thread root, who replied, most recent first.
func (r *Repo) ReplyAuthors(ctx context.Context, roots []uuid.UUID) (map[uuid.UUID][]uuid.UUID, error) {
	out := map[uuid.UUID][]uuid.UUID{}
	if len(roots) == 0 {
		return out, nil
	}
	rows, err := r.q.ListReplyAuthors(ctx, roots)
	if err != nil {
		return nil, err
	}
	for _, x := range rows {
		if x.ParentID.Valid && x.AuthorID.Valid {
			out[x.ParentID.UUID] = append(out[x.ParentID.UUID], x.AuthorID.UUID)
		}
	}
	return out, nil
}

// --- lists across channels

func (r *Repo) Saved(ctx context.Context, ws, user uuid.UUID, limit int) ([]domain.Message, error) {
	rows, err := r.q.ListSavedMessages(ctx, store.ListSavedMessagesParams{WorkspaceID: ws, UserID: user, Lim: int32(limit)})
	return toMessages(rows), err
}

func (r *Repo) MyThreads(ctx context.Context, ws, user uuid.UUID, limit int) ([]domain.Message, error) {
	rows, err := r.q.ListMyThreads(ctx, store.ListMyThreadsParams{WorkspaceID: ws, UserID: user, Lim: int32(limit)})
	return toMessages(rows), err
}

// SearchFilter narrows a message search the way Slack's modifiers do.
type SearchFilter struct {
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

// Search finds messages matching the text and filters in channels the user can see.
func (r *Repo) Search(ctx context.Context, ws, user uuid.UUID, f SearchFilter, limit int) ([]domain.Message, error) {
	esc := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(f.Q)
	rows, err := r.q.SearchMessages(ctx, store.SearchMessagesParams{WorkspaceID: ws, UserID: user, Q: esc,
		ChannelID: nullID(f.ChannelID), FromID: nullID(f.FromID), MentionsMe: f.MentionsMe, HasLink: f.HasLink,
		HasFile: f.HasFile, ThreadsOnly: f.ThreadsOnly, After: f.After, Before: f.Before, Lim: int32(limit)})
	return toMessages(rows), err
}

// --- presence

func (r *Repo) TouchPresence(ctx context.Context, user uuid.UUID) error {
	return r.q.TouchPresence(ctx, user)
}

func (r *Repo) Online(ctx context.Context, ws uuid.UUID) ([]uuid.UUID, error) {
	return r.q.OnlineMembers(ctx, ws)
}

// SetFeed turns a channel's task feed on or off; project nil means every project.
func (r *Repo) SetFeed(ctx context.Context, id uuid.UUID, on bool, project *uuid.UUID) (domain.Channel, error) {
	row, err := r.q.SetFeed(ctx, store.SetFeedParams{ID: id, Feed: on, FeedProjectID: nullID(project)})
	if err != nil {
		return domain.Channel{}, notFound(err)
	}
	return toChannel(row), nil
}

// FeedChannels lists the feed channels of a workspace that take updates of the project.
func (r *Repo) FeedChannels(ctx context.Context, ws, project uuid.UUID) ([]domain.Channel, error) {
	rows, err := r.q.ListFeedChannels(ctx, store.ListFeedChannelsParams{WorkspaceID: ws, FeedProjectID: nullID(&project)})
	if err != nil {
		return nil, err
	}
	out := make([]domain.Channel, len(rows))
	for i, c := range rows {
		out[i] = toChannel(c)
	}
	return out, nil
}

// InsertEvent stores a task update as a message authored by the person who made the change.
func (r *Repo) InsertEvent(ctx context.Context, channel uuid.UUID, actor *uuid.UUID, body string, event []byte) (domain.Message, error) {
	row, err := r.q.InsertEventMessage(ctx, store.InsertEventMessageParams{ChannelID: channel, AuthorID: nullID(actor), Body: body, Event: event})
	if err != nil {
		return domain.Message{}, err
	}
	return toMessage(row), nil
}
