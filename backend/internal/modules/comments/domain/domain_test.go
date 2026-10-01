package domain

import (
	"testing"

	"github.com/google/uuid"
)

func TestParseMentions(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	cases := []struct {
		name string
		body string
		want []uuid.UUID
	}{
		{"none", "plain text @someone", nil},
		{"one", "hi @[Olena K](" + a.String() + ")!", []uuid.UUID{a}},
		{"dedupe and order", "@[B](" + b.String() + ") @[A](" + a.String() + ") @[B again](" + b.String() + ")", []uuid.UUID{b, a}},
		{"bad uuid", "@[X](not-a-uuid)", nil},
		{"newline in name", "@[A\nB](" + a.String() + ")", nil},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := ParseMentions(c.body)
			if len(got) != len(c.want) {
				t.Fatalf("got %v want %v", got, c.want)
			}
			for i := range got {
				if got[i] != c.want[i] {
					t.Fatalf("got %v want %v", got, c.want)
				}
			}
		})
	}
}
