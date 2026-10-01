package validation

import (
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func codeOf(t *testing.T, err error, field string) string {
	t.Helper()
	if err == nil {
		return ""
	}
	for _, f := range apperr.From(err).Fields {
		if f.Field == field {
			return f.Code
		}
	}
	return ""
}

func TestEmail(t *testing.T) {
	cases := map[string]string{
		"a@b.co": "", "": Required, "nope": Email, "Name <a@b.co>": Email, "a@localhost": Email,
	}
	for in, want := range cases {
		var v V
		v.Email("email", in)
		if got := codeOf(t, v.Err(), "email"); got != want {
			t.Errorf("%q: got %q want %q", in, got, want)
		}
	}
}

func TestPassword(t *testing.T) {
	cases := map[string]string{
		"Short1!":           MinLength,
		"alllowercaseonly":  Weak,
		"lowercase123456":   Weak,
		"Lowercase123456":   "",
		"пароль-Довгий-123": "",
	}
	for in, want := range cases {
		var v V
		v.Password("password", in)
		if got := codeOf(t, v.Err(), "password"); got != want {
			t.Errorf("%q: got %q want %q", in, got, want)
		}
	}
}

func TestLengthOneOfAndFirstErrorWins(t *testing.T) {
	var v V
	v.Length("name", "a", 2, 10)
	v.Length("name", "aaaaaaaaaaaaaa", 2, 10)
	v.OneOf("role", "god", "admin", "member")
	err := v.Err()
	if codeOf(t, err, "name") != MinLength || codeOf(t, err, "role") != OneOf {
		t.Fatalf("unexpected %v", apperr.From(err).Fields)
	}
	if len(apperr.From(err).Fields) != 2 {
		t.Fatal("only the first error per field should be kept")
	}
	var ok V
	if ok.Err() != nil {
		t.Fatal("empty validator must return nil")
	}
}
