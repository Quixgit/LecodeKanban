// Package validation accumulates field errors with translatable codes.
package validation

import (
	"net/mail"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Field error codes (translated client-side under errors:validation.<code>).
const (
	Required  = "required"
	Email     = "email"
	MinLength = "min_length"
	MaxLength = "max_length"
	OneOf     = "one_of"
	Weak      = "password_weak"
	Range     = "range"       // number outside {min,max}
	NotMember = "not_member"  // user is not a member of the workspace
	NotFound  = "not_found"   // referenced entity does not exist (in this workspace)
	KeyFormat = "project_key" // project key format
	DateOrder = "date_order"  // end date before start date
	Count     = "count"       // list length outside {min,max}
)

// All lists every field-error code (used to verify translations).
var All = []string{Required, Email, MinLength, MaxLength, OneOf, Weak, Range, NotMember, NotFound, KeyFormat, DateOrder, Count}

// V collects field errors; the zero value is ready to use.
type V struct{ fields []apperr.FieldError }

func (v *V) Add(field, code string, params map[string]any) {
	for _, f := range v.fields {
		if f.Field == field {
			return // first error per field wins
		}
	}
	v.fields = append(v.fields, apperr.FieldError{Field: field, Code: code, Params: params})
}

func (v *V) Required(field, value string) bool {
	if strings.TrimSpace(value) == "" {
		v.Add(field, Required, nil)
		return false
	}
	return true
}

func (v *V) Email(field, value string) {
	if !v.Required(field, value) {
		return
	}
	a, err := mail.ParseAddress(value)
	if err != nil || a.Address != value || !strings.Contains(value[strings.LastIndexByte(value, '@')+1:], ".") {
		v.Add(field, Email, nil)
	}
}

func (v *V) Length(field, value string, minLen, maxLen int) {
	n := utf8.RuneCountInString(strings.TrimSpace(value))
	switch {
	case minLen > 0 && n < minLen:
		v.Add(field, MinLength, map[string]any{"min": minLen})
	case maxLen > 0 && n > maxLen:
		v.Add(field, MaxLength, map[string]any{"max": maxLen})
	}
}

func (v *V) OneOf(field, value string, allowed ...string) {
	if !slices.Contains(allowed, value) {
		v.Add(field, OneOf, map[string]any{"allowed": allowed})
	}
}

// Password enforces length 10–128 and at least three Unicode character classes
// (lower, upper, digit, other), so Cyrillic passwords are judged fairly.
func (v *V) Password(field, value string) {
	if !v.Required(field, value) {
		return
	}
	n := utf8.RuneCountInString(value)
	if n < 10 {
		v.Add(field, MinLength, map[string]any{"min": 10})
		return
	}
	if n > 128 {
		v.Add(field, MaxLength, map[string]any{"max": 128})
		return
	}
	var lower, upper, digit, other bool
	for _, r := range value {
		switch {
		case unicode.IsLower(r):
			lower = true
		case unicode.IsUpper(r):
			upper = true
		case unicode.IsDigit(r):
			digit = true
		default:
			other = true
		}
	}
	classes := 0
	for _, b := range []bool{lower, upper, digit, other} {
		if b {
			classes++
		}
	}
	if classes < 3 {
		v.Add(field, Weak, nil)
	}
}

// Err returns a common.validation error, or nil when there are no field errors.
func (v *V) Err() error {
	if len(v.fields) == 0 {
		return nil
	}
	e := apperr.New(apperr.Validation, "validation failed")
	e.Fields = v.fields
	return e
}
