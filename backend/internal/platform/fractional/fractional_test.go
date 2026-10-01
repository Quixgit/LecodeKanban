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

func TestBetweenUniqueStaysInBoundsAndDiffers(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2))
	keys := Sequence("", 5)
	for i := 0; i < 2000; i++ {
		a, b := "", ""
		switch r.IntN(3) {
		case 0:
			a = keys[r.IntN(len(keys))]
		case 1:
			b = keys[r.IntN(len(keys))]
		default:
			x, y := r.IntN(len(keys)), r.IntN(len(keys))
			if x == y {
				continue
			}
			a, b = keys[min(x, y)], keys[max(x, y)]
		}
		k, err := BetweenUnique(a, b)
		if err != nil || !valid(k) || (a != "" && k <= a) || (b != "" && k >= b) {
			t.Fatalf("BetweenUnique(%q,%q) = %q, %v", a, b, k, err)
		}
		keys = append(keys, k)
		slices.Sort(keys)
	}
	// Same gap twice → different keys.
	x, _ := BetweenUnique("a1", "a2")
	y, _ := BetweenUnique("a1", "a2")
	if x == y {
		t.Fatalf("expected distinct keys, got %q twice", x)
	}
	// Prefix case: the midpoint of ("1","2V") is "2", a prefix of b.
	if k, err := BetweenUnique("1", "2V"); err != nil || k <= "1" || k >= "2V" {
		t.Fatalf("prefix case: %q %v", k, err)
	}
}
