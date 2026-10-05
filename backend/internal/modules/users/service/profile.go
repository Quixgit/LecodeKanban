package service

import (
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/users/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

const (
	maxPronouns = 30
	maxWebsite  = 200
	maxSkills   = 10
	maxSkillLen = 30
)

var whatsappDigits = regexp.MustCompile(`^[0-9]{8,15}$`)
var telegramName = regexp.MustCompile(`^[A-Za-z0-9_]{5,32}$`)
var linkedinPath = regexp.MustCompile(`^[A-Za-z0-9_%\-.]{2,100}$`)

// cleanLinkedIn accepts a profile address or just the handle and returns the canonical address.
func cleanLinkedIn(in string) (string, bool) {
	in = strings.TrimSpace(in)
	if in == "" {
		return "", true
	}
	if !strings.Contains(in, "/") && !strings.Contains(in, ".") {
		in = "https://www.linkedin.com/in/" + in
	}
	if !strings.HasPrefix(in, "http://") && !strings.HasPrefix(in, "https://") {
		in = "https://" + in
	}
	u, err := url.Parse(in)
	if err != nil {
		return "", false
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	if host != "linkedin.com" && !strings.HasSuffix(host, ".linkedin.com") {
		return "", false
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) < 2 || (parts[0] != "in" && parts[0] != "company") || !linkedinPath.MatchString(parts[1]) {
		return "", false
	}
	return "https://www.linkedin.com/" + parts[0] + "/" + parts[1], true
}

// cleanTelegram accepts @name, t.me/name or a t.me address and returns the bare user name.
func cleanTelegram(in string) (string, bool) {
	in = strings.TrimSpace(in)
	if in == "" {
		return "", true
	}
	for _, prefix := range []string{"https://", "http://"} {
		in = strings.TrimPrefix(in, prefix)
	}
	for _, prefix := range []string{"t.me/", "telegram.me/"} {
		in = strings.TrimPrefix(in, prefix)
	}
	in = strings.TrimPrefix(in, "@")
	return in, telegramName.MatchString(in)
}

// cleanWhatsApp accepts a number in any common spelling ("+380 67 123-45-67", "380671234567", wa.me/…) and returns
// it as "+" and 8–15 digits, which is what a wa.me link needs.
func cleanWhatsApp(in string) (string, bool) {
	in = strings.TrimSpace(in)
	if in == "" {
		return "", true
	}
	for _, prefix := range []string{"https://", "http://", "wa.me/", "api.whatsapp.com/send?phone="} {
		in = strings.TrimPrefix(in, prefix)
	}
	var digits strings.Builder
	for _, r := range in {
		switch {
		case r >= '0' && r <= '9':
			digits.WriteRune(r)
		case strings.ContainsRune("+ -().", r):
		default:
			return "", false
		}
	}
	if !whatsappDigits.MatchString(digits.String()) {
		return "", false
	}
	return "+" + digits.String(), true
}

func cleanWebsite(in string) (string, bool) {
	in = strings.TrimSpace(in)
	if in == "" {
		return "", true
	}
	if !strings.Contains(in, "://") {
		in = "https://" + in
	}
	u, err := url.Parse(in)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || utf8.RuneCountInString(in) > maxWebsite {
		return "", false
	}
	return u.String(), true
}

func validHour(s string) bool {
	_, err := time.Parse("15:04", s)
	return err == nil && len(s) == 5
}

// checkExtras validates and normalises the contact, working-hours, skills and cover fields of a patch.
func checkExtras(v *validation.V, p *domain.ProfilePatch) {
	if p.Pronouns != nil {
		s := strings.TrimSpace(*p.Pronouns)
		v.Length("pronouns", s, 0, maxPronouns)
		p.Pronouns = &s
	}
	if p.LinkedIn != nil {
		s, ok := cleanLinkedIn(*p.LinkedIn)
		if !ok {
			v.Add("linkedin", validation.OneOf, nil)
		}
		p.LinkedIn = &s
	}
	if p.Telegram != nil {
		s, ok := cleanTelegram(*p.Telegram)
		if !ok {
			v.Add("telegram", validation.OneOf, nil)
		}
		p.Telegram = &s
	}
	if p.Whatsapp != nil {
		s, ok := cleanWhatsApp(*p.Whatsapp)
		if !ok {
			v.Add("whatsapp", validation.OneOf, nil)
		}
		p.Whatsapp = &s
	}
	if p.Website != nil {
		s, ok := cleanWebsite(*p.Website)
		if !ok {
			v.Add("website", validation.OneOf, nil)
		}
		p.Website = &s
	}
	if p.WorkStart != nil || p.WorkEnd != nil {
		start, end := strDeref(p.WorkStart), strDeref(p.WorkEnd)
		switch {
		case start == "" && end == "":
		case !validHour(start):
			v.Add("workStart", validation.OneOf, nil)
		case !validHour(end):
			v.Add("workEnd", validation.OneOf, nil)
		case start >= end:
			v.Add("workEnd", validation.Range, map[string]any{"min": start})
		}
	}
	if p.Skills != nil {
		out := make([]string, 0, len(*p.Skills))
		seen := map[string]bool{}
		for _, raw := range *p.Skills {
			s := strings.TrimSpace(raw)
			key := strings.ToLower(s)
			if s == "" || seen[key] {
				continue
			}
			if utf8.RuneCountInString(s) > maxSkillLen {
				v.Add("skills", validation.MaxLength, map[string]any{"max": maxSkillLen})
				break
			}
			seen[key] = true
			out = append(out, s)
		}
		if len(out) > maxSkills {
			v.Add("skills", validation.Count, map[string]any{"min": 0, "max": maxSkills})
		}
		p.Skills = &out
	}
	if p.CoverPreset != nil && *p.CoverPreset != "" && !slices.Contains(domain.CoverPresets, *p.CoverPreset) {
		v.Add("coverPreset", validation.OneOf, nil)
	}
}

func strDeref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
