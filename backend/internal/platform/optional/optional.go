// Package optional distinguishes "absent", "null" and "value" in JSON PATCH bodies.
package optional

import (
	"bytes"
	"encoding/json"
)

// Field is a JSON field that records whether it was present and whether it was null.
type Field[T any] struct {
	Set   bool
	Null  bool
	Value T
}

func (f *Field[T]) UnmarshalJSON(b []byte) error {
	f.Set = true
	if bytes.Equal(bytes.TrimSpace(b), []byte("null")) {
		f.Null = true
		return nil
	}
	return json.Unmarshal(b, &f.Value)
}

// Ptr returns nil for absent/null, else a pointer to the value.
func (f Field[T]) Ptr() *T {
	if !f.Set || f.Null {
		return nil
	}
	v := f.Value
	return &v
}
