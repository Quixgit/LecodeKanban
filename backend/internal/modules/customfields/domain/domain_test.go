package domain

import (
	"encoding/json"
	"testing"
)

func TestNormalize(t *testing.T) {
	sel := Field{Kind: Select, Options: []Option{{ID: "a", Label: "A"}}}
	cases := []struct {
		name  string
		f     Field
		in    string
		want  string
		clear bool
		fails bool
	}{
		{"text trimmed", Field{Kind: Text}, `"  hi "`, `"hi"`, false, false},
		{"blank text clears", Field{Kind: Text}, `"  "`, "", true, false},
		{"null clears", Field{Kind: Number}, `null`, "", true, false},
		{"text needs a string", Field{Kind: Text}, `5`, "", false, true},
		{"number", Field{Kind: Number}, `12.5`, `12.5`, false, false},
		{"number as text refused", Field{Kind: Number}, `"12"`, "", false, true},
		{"number out of range", Field{Kind: Number}, `1e20`, "", false, true},
		{"date", Field{Kind: Date}, `"2026-10-04"`, `"2026-10-04"`, false, false},
		{"bad date", Field{Kind: Date}, `"04.10.2026"`, "", false, true},
		{"checkbox", Field{Kind: Checkbox}, `true`, `true`, false, false},
		{"url", Field{Kind: URL}, `"https://example.com/x"`, `"https://example.com/x"`, false, false},
		{"javascript url refused", Field{Kind: URL}, `"javascript:alert(1)"`, "", false, true},
		{"select option", sel, `"a"`, `"a"`, false, false},
		{"unknown option", sel, `"zzz"`, "", false, true},
	}
	for _, c := range cases {
		got, clear, err := c.f.Normalize(json.RawMessage(c.in))
		if (err != nil) != c.fails || clear != c.clear || string(got) != c.want {
			t.Errorf("%s: got %q clear=%v err=%v", c.name, got, clear, err)
		}
	}
}
