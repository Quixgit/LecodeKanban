// Package fractional generates order keys for drag-and-drop ordering without
// renumbering siblings ("fractional indexing", the idea behind LexoRank).
//
// Keys are base-62 strings compared bytewise. Between any two keys a < b a new key
// can always be generated; moving one card writes exactly one row.
package fractional

import (
	"errors"
	"strings"
)

const digits = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

var ErrOrder = errors.New("fractional: a must be lower than b")

func index(c byte) int { return strings.IndexByte(digits, c) }

// Between returns a key strictly between a and b. Empty a means "before everything",
// empty b means "after everything"; both empty yields the first key.
func Between(a, b string) (string, error) {
	if a != "" && b != "" && a >= b {
		return "", ErrOrder
	}
	if !valid(a) || !valid(b) {
		return "", errors.New("fractional: invalid key")
	}
	return midpoint(a, b), nil
}

// valid keys use base-62 digits and never end in '0' (so a smaller key always exists).
func valid(k string) bool {
	if k == "" {
		return true
	}
	if k[len(k)-1] == '0' {
		return false
	}
	for i := 0; i < len(k); i++ {
		if index(k[i]) < 0 {
			return false
		}
	}
	return true
}

// midpoint follows David Greenspan's "Implementing Fractional Indexing".
func midpoint(a, b string) string {
	if b != "" {
		// Skip the common prefix (treating missing digits of a as '0').
		n := 0
		for n < len(b) {
			ca := byte('0')
			if n < len(a) {
				ca = a[n]
			}
			if ca != b[n] {
				break
			}
			n++
		}
		if n > 0 {
			rest := ""
			if n < len(a) {
				rest = a[n:]
			}
			return b[:n] + midpoint(rest, b[n:])
		}
	}
	da := 0
	if a != "" {
		da = index(a[0])
	}
	db := len(digits)
	if b != "" {
		db = index(b[0])
	}
	if db-da > 1 {
		return string(digits[(da+db+1)/2])
	}
	// Consecutive leading digits.
	if b != "" && len(b) > 1 {
		return b[:1]
	}
	rest := ""
	if len(a) > 1 {
		rest = a[1:]
	}
	return string(digits[da]) + midpoint(rest, "")
}

// Sequence returns n increasing keys after `after` (for seeding / appending in bulk).
func Sequence(after string, n int) []string {
	out := make([]string, 0, n)
	prev := after
	for i := 0; i < n; i++ {
		k, _ := Between(prev, "")
		out = append(out, k)
		prev = k
	}
	return out
}
