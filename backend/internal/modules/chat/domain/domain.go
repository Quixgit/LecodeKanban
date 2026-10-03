// Package domain holds the chat entities: channels (public, private, direct), messages with
// one-level threads, reactions and read state. Decisions: docs/adr/0016-chat-module.md.
package domain

import (
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Kind string

const (
	Public  Kind = "public"
	Private Kind = "private"
	DM      Kind = "dm"
)

func (k Kind) Valid() bool { return k == Public || k == Private || k == DM }

const (
	MaxBodyLen  = 8000
	MaxTopicLen = 250
	// MaxDMMembers bounds group conversations, the sender included.
	MaxDMMembers = 8
	PageSize     = 40
	MaxPageSize  = 100
)

type Channel struct {
	ID            uuid.UUID
	WorkspaceID   uuid.UUID
	Kind          Kind
	Name          string // empty for direct messages
	Topic         string
	DMKey         string
	CreatedBy     *uuid.UUID
	CreatedAt     time.Time
	LastMessageAt *time.Time
}

// Membership is one user's relation to a channel they have joined.
type Membership struct {
	ChannelID  uuid.UUID
	UserID     uuid.UUID
	JoinedAt   time.Time
	LastReadAt time.Time
	Muted      bool
}

// ChannelState is a channel as one user sees it.
type ChannelState struct {
	Channel
	Joined   bool
	Muted    bool
	Unread   int
	Mentions int
}

type Message struct {
	ID          uuid.UUID
	ChannelID   uuid.UUID
	AuthorID    *uuid.UUID
	ParentID    *uuid.UUID
	Body        string
	Mentions    []uuid.UUID
	ReplyCount  int
	LastReplyAt *time.Time
	CreatedAt   time.Time
	EditedAt    *time.Time
	DeletedAt   *time.Time
}

func (m Message) Deleted() bool { return m.DeletedAt != nil }

// ReactionCount is how many people used a reaction on a message, and whether the viewer did.
type ReactionCount struct {
	Key   string
	Count int
	Mine  bool
	Users []uuid.UUID
}

// Reactions is the closed set of reaction keys. They map to outline icons in the UI: the product
// uses no emoji.
var Reactions = []string{"thumbs-up", "heart", "check", "party-popper", "eyes", "laugh", "flame", "lightbulb"}

func ValidReaction(key string) bool { return slices.Contains(Reactions, key) }

var nameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,39}$`)

// NormalizeName lower-cases a channel name and turns spaces into dashes, as Slack does.
func NormalizeName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	s = strings.TrimPrefix(s, "#")
	return strings.Join(strings.Fields(s), "-")
}

func ValidName(s string) bool { return nameRe.MatchString(s) }

// DMKey identifies a conversation by its participants, independent of order.
func DMKey(ids []uuid.UUID) string {
	parts := make([]string, len(ids))
	for i, id := range ids {
		parts[i] = id.String()
	}
	slices.Sort(parts)
	return strings.Join(parts, ",")
}

// mentionRe matches the markdown mention token the composer inserts: @[Display Name](user-uuid).
var mentionRe = regexp.MustCompile(`@\[[^\]\n]{1,80}\]\(([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\)`)

// ParseMentions returns the distinct user ids mentioned in body, in order of appearance.
func ParseMentions(body string) []uuid.UUID {
	var out []uuid.UUID
	seen := map[uuid.UUID]bool{}
	for _, m := range mentionRe.FindAllStringSubmatch(body, 50) {
		id, err := uuid.Parse(m[1])
		if err != nil || seen[id] {
			continue
		}
		seen[id] = true
		out = append(out, id)
	}
	return out
}

var (
	// ErrNotFound is also returned for private channels the caller may not know exist.
	ErrNotFound   = apperr.Define("chat.not_found", http.StatusNotFound)
	ErrForbidden  = apperr.Define("chat.forbidden", http.StatusForbidden)
	ErrNameTaken  = apperr.Define("chat.name_taken", http.StatusConflict)
	ErrThreadDeep = apperr.Define("chat.thread_depth", http.StatusUnprocessableEntity)
	ErrBadReact   = apperr.Define("chat.bad_reaction", http.StatusUnprocessableEntity)
	ErrDMMembers  = apperr.Define("chat.dm_members", http.StatusUnprocessableEntity)
	ErrNotMember  = apperr.Define("chat.not_member", http.StatusForbidden)
	ErrDeleted    = apperr.Define("chat.message_deleted", http.StatusConflict)
)
