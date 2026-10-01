package fractional

import (
	"errors"
	"math/rand/v2"
	"slices"
	"testing"
)

func TestBetweenBasics(t *testing.T) {
	cases := []struct{ a, b string }{
		{"", ""}, {"", "V"}, {"V", ""}, {"V", "W"}, {"V", "V1"}, {"V01", "V1"}, {"a", "b"}, {"az", "b"},
		{"", "01"}, {"y", "z"}, {"zz", ""},
	}
	for _, c := range cases {
		k, err := Between(c.a, c.b)
		if err != nil {
			t.Fatalf("Between(%q,%q): %v", c.a, c.b, err)
		}
		if (c.a != "" && k <= c.a) || (c.b != "" && k >= c.b) || !valid(k) {
			t.Fatalf("Between(%q,%q) = %q not strictly between / invalid", c.a, c.b, k)
		}
	}
	if _, err := Between("b", "a"); !errors.Is(err, ErrOrder) {
		t.Fatal("reversed bounds must fail")
	}
	if _, err := Between("a0", ""); err == nil {
		t.Fatal("keys ending in 0 are invalid")
	}
}

// Random inserts anywhere must always keep a strict total order.
func TestRandomInsertionsStayOrdered(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2))
	keys := []string{}
	for i := 0; i < 3000; i++ {
		pos := r.IntN(len(keys) + 1)
		a, b := "", ""
		if pos > 0 {
			a = keys[pos-1]
		}
		if pos < len(keys) {
			b = keys[pos]
		}
		k, err := Between(a, b)
		if err != nil {
			t.Fatalf("insert %d: %v", i, err)
		}
		keys = slices.Insert(keys, pos, k)
	}
	if !slices.IsSorted(keys) {
		t.Fatal("keys out of order")
	}
	for i := 1; i < len(keys); i++ {
		if keys[i] == keys[i-1] {
			t.Fatal("duplicate key")
		}
	}
}

// Repeatedly inserting at the same spot (worst case) grows keys only slowly.
func TestAdversarialGrowth(t *testing.T) {
	a, b := "V", "W"
	for i := 0; i < 500; i++ {
		k, _ := Between(a, b)
		b = k
	}
	if len(b) > 100 {
		t.Fatalf("key grew too long: %d", len(b))
	}
	seq := Sequence("", 5)
	if !slices.IsSorted(seq) || len(seq) != 5 {
		t.Fatalf("sequence %v", seq)
	}
}
