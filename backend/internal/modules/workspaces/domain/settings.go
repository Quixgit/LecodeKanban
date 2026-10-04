package domain

import (
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Features are the parts of the platform an administrator can switch off for the workspace.
type Features struct {
	Chat         bool `json:"chat"`
	Docs         bool `json:"docs"`
	Time         bool `json:"time"`
	Calendar     bool `json:"calendar"`
	Integrations bool `json:"integrations"`
}

// Settings are the workspace-wide choices of its administrators. Missing values fall back to Defaults.
type Settings struct {
	Description       string   `json:"description"`
	InviteDays        int      `json:"inviteDays"`        // how long an invitation stays valid
	DefaultInviteRole Role     `json:"defaultInviteRole"` // pre-selected in the invite form
	AllowedDomains    []string `json:"allowedDomains"`    // empty: any address may be invited
	DefaultPriority   string   `json:"defaultPriority"`   // low | medium | high
	RequireDueDate    bool     `json:"requireDueDate"`    // new tasks need a due date
	WeekStart         int      `json:"weekStart"`         // 0 Sunday, 1 Monday
	Features          Features `json:"features"`
}

func Defaults() Settings {
	return Settings{
		InviteDays: 7, DefaultInviteRole: RoleMember, AllowedDomains: []string{},
		DefaultPriority: "medium", WeekStart: 1,
		Features: Features{Chat: true, Docs: true, Time: true, Calendar: true, Integrations: true},
	}
}

// SettingsPatch changes some settings; nil means unchanged.
type SettingsPatch struct {
	Description       *string
	InviteDays        *int
	DefaultInviteRole *Role
	AllowedDomains    *[]string
	DefaultPriority   *string
	RequireDueDate    *bool
	WeekStart         *int
	Features          *Features
}

const (
	MaxDescription = 300
	MaxDomains     = 20
)

var domainRE = regexp.MustCompile(`^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$`)

// NormalizeDomain accepts "Example.com", "@example.com" or a full address and returns "example.com".
func NormalizeDomain(in string) (string, bool) {
	d := strings.ToLower(strings.TrimSpace(in))
	if i := strings.LastIndex(d, "@"); i >= 0 {
		d = d[i+1:]
	}
	return d, domainRE.MatchString(d)
}

// EmailAllowed reports whether an address may be invited under the allowed-domains list.
func (s Settings) EmailAllowed(email string) bool {
	if len(s.AllowedDomains) == 0 {
		return true
	}
	i := strings.LastIndex(email, "@")
	return i >= 0 && slices.Contains(s.AllowedDomains, strings.ToLower(email[i+1:]))
}

// Apply returns the settings with the patch applied, and the names of the fields that were
// validated badly (empty when everything is fine).
func (s Settings) Apply(p SettingsPatch) (Settings, []string) {
	var bad []string
	oneOf := func(field string, v *string, dst *string, allowed ...string) {
		if v == nil {
			return
		}
		if !slices.Contains(allowed, *v) {
			bad = append(bad, field)
			return
		}
		*dst = *v
	}
	if p.Description != nil {
		d := strings.TrimSpace(*p.Description)
		if utf8.RuneCountInString(d) > MaxDescription {
			bad = append(bad, "description")
		} else {
			s.Description = d
		}
	}
	oneOf("defaultPriority", p.DefaultPriority, &s.DefaultPriority, "low", "medium", "high")
	if p.InviteDays != nil {
		if *p.InviteDays < 1 || *p.InviteDays > 30 {
			bad = append(bad, "inviteDays")
		} else {
			s.InviteDays = *p.InviteDays
		}
	}
	if p.DefaultInviteRole != nil {
		if r := *p.DefaultInviteRole; r != RoleAdmin && r != RoleMember && r != RoleViewer {
			bad = append(bad, "defaultInviteRole")
		} else {
			s.DefaultInviteRole = r
		}
	}
	if p.WeekStart != nil {
		if *p.WeekStart != 0 && *p.WeekStart != 1 {
			bad = append(bad, "weekStart")
		} else {
			s.WeekStart = *p.WeekStart
		}
	}
	if p.RequireDueDate != nil {
		s.RequireDueDate = *p.RequireDueDate
	}
	if p.Features != nil {
		s.Features = *p.Features
	}
	if p.AllowedDomains != nil {
		out := []string{}
		for _, raw := range *p.AllowedDomains {
			if strings.TrimSpace(raw) == "" {
				continue
			}
			d, ok := NormalizeDomain(raw)
			if !ok {
				bad = append(bad, "allowedDomains")
				break
			}
			if !slices.Contains(out, d) {
				out = append(out, d)
			}
		}
		if len(out) > MaxDomains {
			bad = append(bad, "allowedDomains")
		}
		s.AllowedDomains = out
	}
	return s, bad
}

// Changes lists the setting names whose values differ, for the audit log.
func (s Settings) Changes(next Settings) []string {
	var out []string
	add := func(name string, differs bool) {
		if differs {
			out = append(out, name)
		}
	}
	add("description", s.Description != next.Description)
	add("inviteDays", s.InviteDays != next.InviteDays)
	add("defaultInviteRole", s.DefaultInviteRole != next.DefaultInviteRole)
	add("allowedDomains", !slices.Equal(s.AllowedDomains, next.AllowedDomains))
	add("defaultPriority", s.DefaultPriority != next.DefaultPriority)
	add("requireDueDate", s.RequireDueDate != next.RequireDueDate)
	add("weekStart", s.WeekStart != next.WeekStart)
	add("features", s.Features != next.Features)
	return out
}

// AuditEntry is one administrator action.
type AuditEntry struct {
	ID      uuid.UUID
	ActorID *uuid.UUID
	Action  string
	Details map[string]any
	At      time.Time
}

var (
	// ErrPolicy: the workspace's settings do not allow this action.
	ErrPolicy = apperr.Define("workspaces.policy", http.StatusForbidden)
	// ErrDomainNotAllowed: the address is outside the allowed domains.
	// ErrRoleNotFound: the role does not exist (any more).
	ErrRoleNotFound = apperr.Define("workspaces.role_not_found", http.StatusNotFound)
	// ErrRoleNameTaken: another role has this name.
	ErrRoleNameTaken = apperr.Define("workspaces.role_name_taken", http.StatusConflict)
	// ErrRoleInUse: reserved for roles that cannot be removed.
	ErrRoleLocked = apperr.Define("workspaces.role_locked", http.StatusForbidden)
	// ErrTooManyRoles: the workspace reached its limit of custom roles.
	ErrTooManyRoles     = apperr.Define("workspaces.too_many_roles", http.StatusUnprocessableEntity)
	ErrDomainNotAllowed = apperr.Define("workspaces.domain_not_allowed", http.StatusUnprocessableEntity)
)
