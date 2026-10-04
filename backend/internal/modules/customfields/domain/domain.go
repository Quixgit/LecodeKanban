// Package domain holds the custom-fields module's entities, value rules and errors.
package domain

import (
	"encoding/json"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

type Kind string

const (
	Text     Kind = "text"
	Number   Kind = "number"
	Date     Kind = "date"
	Select   Kind = "select"
	Checkbox Kind = "checkbox"
	URL      Kind = "url"
)

var Kinds = []Kind{Text, Number, Date, Select, Checkbox, URL}

func (k Kind) Valid() bool {
	for _, v := range Kinds {
		if v == k {
			return true
		}
	}
	return false
}

// Limits keep the card drawer and the board readable.
const (
	MaxFields      = 30
	MaxOptions     = 50
	MaxNameLen     = 60
	MaxOptionLen   = 40
	MaxTextLen     = 500
	MaxDescription = 200
)

// Option is one choice of a select field.
type Option struct {
	ID    string `json:"id"`
	Label string `json:"label"`
	Tone  string `json:"tone"`
}

var Tones = []string{"teal", "amber", "purple", "red", "neutral"}

type Field struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Description string
	Kind        Kind
	Options     []Option
	ShowOnCard  bool
	Position    int
	CreatedAt   time.Time
}

// Value is one card's value for a field, as JSON (string, number or boolean by kind).
type Value struct {
	CardID  uuid.UUID
	FieldID uuid.UUID
	Value   json.RawMessage
}

type NewField struct {
	Name        string
	Description string
	Kind        Kind
	Options     []Option
	ShowOnCard  bool
}

// FieldPatch changes a field; the kind never changes (values would stop making sense).
type FieldPatch struct {
	Name        *string
	Description *string
	Options     *[]Option
	ShowOnCard  *bool
}

// Normalize checks a raw JSON value against the field's kind and returns its canonical form.
// A JSON null (or an empty text) means "clear" and returns (nil, true, nil).
func (f Field) Normalize(raw json.RawMessage) (out json.RawMessage, clear bool, err error) {
	bad := apperr.New(ErrBadValue, "the value does not fit this field")
	if len(raw) == 0 || string(raw) == "null" {
		return nil, true, nil
	}
	switch f.Kind {
	case Text, URL:
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return nil, false, bad
		}
		s = strings.TrimSpace(s)
		if s == "" {
			return nil, true, nil
		}
		if utf8.RuneCountInString(s) > MaxTextLen {
			return nil, false, bad
		}
		if f.Kind == URL {
			u, perr := url.Parse(s)
			if perr != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
				return nil, false, bad
			}
		}
		b, _ := json.Marshal(s)
		return b, false, nil
	case Number:
		var n float64
		if json.Unmarshal(raw, &n) != nil || math.IsNaN(n) || math.IsInf(n, 0) || math.Abs(n) > 1e15 {
			return nil, false, bad
		}
		b, _ := json.Marshal(n)
		return b, false, nil
	case Date:
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return nil, false, bad
		}
		if s == "" {
			return nil, true, nil
		}
		if _, perr := time.Parse("2006-01-02", s); perr != nil {
			return nil, false, bad
		}
		b, _ := json.Marshal(s)
		return b, false, nil
	case Checkbox:
		var v bool
		if json.Unmarshal(raw, &v) != nil {
			return nil, false, bad
		}
		b, _ := json.Marshal(v)
		return b, false, nil
	case Select:
		var s string
		if json.Unmarshal(raw, &s) != nil {
			return nil, false, bad
		}
		if s == "" {
			return nil, true, nil
		}
		for _, o := range f.Options {
			if o.ID == s {
				b, _ := json.Marshal(s)
				return b, false, nil
			}
		}
		return nil, false, bad
	}
	return nil, false, bad
}

var (
	ErrNotFound  = apperr.Define("fields.not_found", http.StatusNotFound)
	ErrNameTaken = apperr.Define("fields.name_taken", http.StatusConflict)
	ErrTooMany   = apperr.Define("fields.too_many", http.StatusUnprocessableEntity)
	ErrBadValue  = apperr.Define("fields.bad_value", http.StatusUnprocessableEntity)
)
