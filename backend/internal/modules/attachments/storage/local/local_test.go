package local

import (
	"context"
	"io"
	"strings"
	"testing"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

func TestPutOpenDelete(t *testing.T) {
	d, err := New(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	key := "ab/abcdef01-2345-6789-abcd-ef0123456789"
	n, err := d.Put(ctx, key, strings.NewReader("hello"), 10)
	if err != nil || n != 5 {
		t.Fatalf("put: %d %v", n, err)
	}
	f, err := d.Open(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(f)
	_ = f.Close()
	if string(b) != "hello" {
		t.Fatalf("read %q", b)
	}
	if err := d.Delete(ctx, key); err != nil {
		t.Fatal(err)
	}
	if _, err := d.Open(ctx, key); !apperr.IsCode(err, domain.ErrNotFound) {
		t.Fatalf("want not found, got %v", err)
	}
	if err := d.Delete(ctx, key); err != nil {
		t.Fatalf("delete is idempotent: %v", err)
	}
}

func TestPutRejectsTooLargeAndBadKeys(t *testing.T) {
	d, _ := New(t.TempDir())
	ctx := context.Background()
	if _, err := d.Put(ctx, "ab/abcdef01-2345-6789-abcd-ef0123456789", strings.NewReader("too long"), 3); !apperr.IsCode(err, domain.ErrTooLarge) {
		t.Fatalf("want too_large, got %v", err)
	}
	for _, k := range []string{"../etc/passwd", "ab/../../x", "plain"} {
		if _, err := d.Put(ctx, k, strings.NewReader("x"), 3); err == nil {
			t.Fatalf("key %q must be rejected", k)
		}
	}
}
