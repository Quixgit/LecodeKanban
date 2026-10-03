// Package domain holds the GitHub integration model: a workspace connection, repositories linked to
// projects, and links between cards and pull requests or issues.
package domain

import (
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

var (
	ErrNotConnected  = apperr.Define("github.not_connected", http.StatusNotFound)
	ErrBadToken      = apperr.Define("github.bad_token", http.StatusUnprocessableEntity)
	ErrRepoNotFound  = apperr.Define("github.repo_not_found", http.StatusUnprocessableEntity)
	ErrRepoLinked    = apperr.Define("github.repo_linked", http.StatusConflict)
	ErrProjectNotSet = apperr.Define("github.project_not_linked", http.StatusConflict)
	ErrUpstream      = apperr.Define("github.upstream", http.StatusBadGateway)
	ErrBadSignature  = apperr.Define("github.bad_signature", http.StatusUnauthorized)
)

type LinkKind string

const (
	PR    LinkKind = "pr"
	Issue LinkKind = "issue"
)

type LinkState string

const (
	Open   LinkState = "open"
	Draft  LinkState = "draft"
	Merged LinkState = "merged"
	Closed LinkState = "closed"
)

// Rules say what GitHub activity does to cards and what card changes do on GitHub.
type Rules struct {
	PROpenedToReview bool // an opened pull request moves its tasks to In review
	PRMergedToDone   bool // a merged one moves them to Done
	SyncIssues       bool // issues and cards follow each other (new issue = new card, done = closed)
	CommentOnPR      bool // moving a task comments on its pull requests
}

type Connection struct {
	WorkspaceID   uuid.UUID
	ConnectedBy   uuid.UUID
	AccountLogin  string
	Token         []byte // sealed
	WebhookSecret []byte // sealed
	Enabled       bool
	Rules         Rules
}

type Repo struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	ProjectID   uuid.UUID
	FullName    string
	HookID      *int64
}

type Link struct {
	ID       uuid.UUID
	CardID   uuid.UUID
	RepoID   uuid.UUID
	RepoName string
	Kind     LinkKind
	Number   int
	Title    string
	State    LinkState
	URL      string
	Author   string
	Updated  time.Time
}

// Key is a task key found in text, like PLT-12.
type Key struct {
	Project string
	Number  int
}

var keyRe = regexp.MustCompile(`(?i)\b([A-Z][A-Z0-9]{1,9})-(\d{1,6})\b`)

// ExtractKeys finds task keys in the given texts (a title, a branch, a body), upper-cased and without
// repeats, in order of appearance.
func ExtractKeys(texts ...string) []Key {
	var out []Key
	seen := map[Key]bool{}
	for _, t := range texts {
		for _, m := range keyRe.FindAllStringSubmatch(t, -1) {
			n := 0
			for _, d := range m[2] {
				n = n*10 + int(d-'0')
			}
			k := Key{Project: strings.ToUpper(m[1]), Number: n}
			if n > 0 && !seen[k] {
				seen[k] = true
				out = append(out, k)
			}
		}
	}
	return out
}

// BranchName suggests a branch for a task: "plt-12-migrate-server-to-new-infra".
func BranchName(key, title string) string {
	var b strings.Builder
	b.WriteString(strings.ToLower(key))
	dash := true
	words := 0
	for _, r := range title {
		switch {
		case unicode.IsLetter(r) && r < unicode.MaxASCII || unicode.IsDigit(r):
			if dash {
				b.WriteByte('-')
				words++
			}
			dash = false
			b.WriteRune(unicode.ToLower(r))
		default:
			dash = true
		}
		if words >= 7 && dash {
			break
		}
	}
	out := b.String()
	if len(out) > 60 {
		out = strings.TrimRight(out[:60], "-")
	}
	return out
}

// IssueMarker is hidden in the body of issues the app creates, so the webhook for them is recognised.
const IssueMarkerPrefix = "<!-- lk:card="

func IssueMarker(card uuid.UUID) string { return IssueMarkerPrefix + card.String() + " -->" }

// MarkedCard reads the card id back out of an issue body.
func MarkedCard(body string) (uuid.UUID, bool) {
	i := strings.Index(body, IssueMarkerPrefix)
	if i < 0 {
		return uuid.Nil, false
	}
	rest := body[i+len(IssueMarkerPrefix):]
	j := strings.Index(rest, " -->")
	if j < 0 {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(rest[:j])
	return id, err == nil
}
