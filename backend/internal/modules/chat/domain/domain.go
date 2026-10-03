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
	// Project and Card conversations hang off a board or a task and never appear in the channel list.
	Project Kind = "project"
	Card    Kind = "card"
)

func (k Kind) Valid() bool { return k == Public || k == Private || k == DM || k.Scoped() }

// Scoped kinds belong to a project or a card; every workspace member may read and post.
func (k Kind) Scoped() bool { return k == Project || k == Card }

const (
	MaxBodyLen  = 8000
	MaxTopicLen = 250
	// MaxDMMembers bounds group conversations, the sender included.
	MaxDMMembers = 8
	PageSize     = 40
	MaxPageSize  = 100
)

type Channel struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Kind        Kind
	Name        string // empty for direct messages
	Topic       string
	DMKey       string
	// RefID is the project or card of a scoped conversation.
	RefID         *uuid.UUID
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
	Starred  bool
	Unread   int
	Mentions int
}

type Message struct {
	ID        uuid.UUID
	ChannelID uuid.UUID
	AuthorID  *uuid.UUID
	ParentID  *uuid.UUID
	Body      string
	Mentions  []uuid.UUID
	// MentionAll is set by @channel, @here or @everyone: every member counts as mentioned.
	MentionAll  bool
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

// ValidReaction accepts a built-in icon key or a single emoji (with its modifiers and joiners).
func ValidReaction(key string) bool { return slices.Contains(Reactions, key) || IsEmoji(key) }

// IsEmoji reports whether s is one to a few emoji: pictographs, flags, keycaps, skin tones, zero-width
// joiners and variation selectors, and nothing else.
func IsEmoji(s string) bool {
	if s == "" || len(s) > 32 {
		return false
	}
	pictograph := false
	for _, r := range s {
		switch {
		case r >= 0x1F300 && r <= 0x1FAFF, // symbols, emoticons, transport, supplemental, extended-A
			r >= 0x2600 && r <= 0x27BF,   // misc symbols and dingbats
			r >= 0x2B00 && r <= 0x2BFF,   // arrows and stars (⭐ ⬆)
			r >= 0x1F1E6 && r <= 0x1F1FF, // regional indicators (flags)
			r == 0x00A9, r == 0x00AE, r == 0x203C, r == 0x2049, r == 0x2122, r == 0x2139,
			r >= 0x2190 && r <= 0x21FF, r >= 0x231A && r <= 0x23FF, r == 0x24C2,
			r >= 0x25AA && r <= 0x25FE, r >= 0x2934 && r <= 0x2935, r == 0x3030, r == 0x303D, r == 0x3297, r == 0x3299:
			pictograph = true
		case r >= '0' && r <= '9', r == '#', r == '*': // keycap bases: only valid with U+20E3 below
		case r == 0x200D, r == 0xFE0F, r == 0x20E3, r >= 0x1F3FB && r <= 0x1F3FF, r >= 0xE0020 && r <= 0xE007F:
			// joiner, variation selector, keycap, skin tones, tag characters (subdivision flags)
		default:
			return false
		}
	}
	if !pictograph {
		return strings.HasSuffix(s, "\u20e3") // 1️⃣ #️⃣ ...
	}
	return true
}

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

// File is an attachment: uploaded to a channel first, then bound to the message that carries it.
type File struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	ChannelID   uuid.UUID
	MessageID   *uuid.UUID
	UploadedBy  *uuid.UUID
	Name        string
	ContentType string
	Size        int64
	StorageKey  string
	CreatedAt   time.Time
}

// MaxFilesPerMessage bounds attachments on one message.
const MaxFilesPerMessage = 10

// InlineImageTypes may be shown inline in the browser; everything else downloads.
var InlineImageTypes = map[string]bool{"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true}

var mentionAllRe = regexp.MustCompile(`(^|[\s(])@(channel|here|everyone)\b`)

// MentionsAll reports whether body addresses the whole channel with @channel, @here or @everyone.
func MentionsAll(body string) bool { return mentionAllRe.MatchString(body) }

var (
	// ErrNotFound is also returned for private channels the caller may not know exist.
	ErrNotFound     = apperr.Define("chat.not_found", http.StatusNotFound)
	ErrForbidden    = apperr.Define("chat.forbidden", http.StatusForbidden)
	ErrNameTaken    = apperr.Define("chat.name_taken", http.StatusConflict)
	ErrThreadDeep   = apperr.Define("chat.thread_depth", http.StatusUnprocessableEntity)
	ErrBadReact     = apperr.Define("chat.bad_reaction", http.StatusUnprocessableEntity)
	ErrDMMembers    = apperr.Define("chat.dm_members", http.StatusUnprocessableEntity)
	ErrNotMember    = apperr.Define("chat.not_member", http.StatusForbidden)
	ErrDeleted      = apperr.Define("chat.message_deleted", http.StatusConflict)
	ErrNoFile       = apperr.Define("chat.no_file", http.StatusBadRequest)
	ErrTooManyFiles = apperr.Define("chat.too_many_files", http.StatusUnprocessableEntity)
)
