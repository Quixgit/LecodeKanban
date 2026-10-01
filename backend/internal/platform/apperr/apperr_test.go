package apperr

import (
	"errors"
	"fmt"
	"net/http"
	"testing"
)

func TestDefineAndStatus(t *testing.T) {
	c := Define("test.thing", http.StatusTeapot)
	if Status(c) != http.StatusTeapot {
		t.Fatal("status not registered")
	}
	if Status("unknown.code") != 500 {
		t.Fatal("unknown codes must map to 500")
	}
	found := false
	for _, x := range Codes() {
		found = found || x == c
	}
	if !found {
		t.Fatal("code missing from catalog")
	}
}

func TestDefineConflictingStatusPanics(t *testing.T) {
	Define("test.dup", 400)
	defer func() {
		if recover() == nil {
			t.Fatal("expected panic")
		}
	}()
	Define("test.dup", 401)
}

func TestIsAndFrom(t *testing.T) {
	sentinel := New(NotFound, "x")
	wrapped := fmt.Errorf("ctx: %w", Wrap(NotFound, "user", errors.New("no rows")))
	if !errors.Is(wrapped, sentinel) {
		t.Fatal("errors.Is should match by code")
	}
	if From(errors.New("boom")).Code != Internal {
		t.Fatal("plain errors become internal")
	}
	if From(wrapped).Code != NotFound {
		t.Fatal("From should unwrap app errors")
	}
	m := New(RateLimited, "slow").WithMeta("retry_after", 30)
	if m.Meta["retry_after"] != 30 {
		t.Fatal("meta not set")
	}
}
