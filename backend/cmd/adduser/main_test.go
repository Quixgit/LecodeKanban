package main

import (
	"strings"
	"testing"
	"unicode"

	"github.com/reliabilix/lecodekanban/backend/internal/platform/validation"
)

func TestNameAndParse(t *testing.T) {
	if got := nameFromEmail("a.petrenko@example.com"); got != "A Petrenko" {
		t.Fatalf("name = %q", got)
	}
	if got := nameFromEmail("o.shcherbyna@x.io"); got != "O Shcherbyna" {
		t.Fatalf("name = %q", got)
	}
	email, name, err := parse("Anna Petrenko <A.Petrenko@Example.com>")
	if err != nil || email != "a.petrenko@example.com" || name != "Anna Petrenko" {
		t.Fatalf("parse: %q %q %v", email, name, err)
	}
	if _, _, err := parse("not an address"); err == nil {
		t.Fatal("garbage accepted")
	}
}

func TestPasswordIsStrongAndRandom(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		p, err := password()
		if err != nil || len(p) != 18 {
			t.Fatalf("password: %q %v", p, err)
		}
		var v validation.V
		v.Password("password", p)
		if v.Err() != nil {
			t.Fatalf("%q fails the platform's own password rules: %v", p, v.Err())
		}
		if strings.IndexFunc(p, unicode.IsSpace) >= 0 || seen[p] {
			t.Fatalf("bad or repeated password %q", p)
		}
		seen[p] = true
	}
}
