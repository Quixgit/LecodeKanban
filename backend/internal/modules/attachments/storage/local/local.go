// Package local stores attachment bytes on the local filesystem (a Docker volume in production).
package local

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/attachments/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// keyRe admits only the opaque keys the service generates (no path traversal).
var keyRe = regexp.MustCompile(`^[0-9a-f]{2}/[0-9a-f-]{36}$`)

type Disk struct{ root string }

// New creates the root directory if needed.
func New(root string) (*Disk, error) {
	if err := os.MkdirAll(root, 0o750); err != nil {
		return nil, fmt.Errorf("attachments: storage dir: %w", err)
	}
	return &Disk{root: root}, nil
}

func (d *Disk) path(key string) (string, error) {
	if !keyRe.MatchString(key) {
		return "", fmt.Errorf("attachments: invalid storage key %q", key)
	}
	return filepath.Join(d.root, filepath.FromSlash(key)), nil
}

// Put writes to a temporary file and renames it into place once complete.
func (d *Disk) Put(_ context.Context, key string, r io.Reader, max int64) (int64, error) {
	dst, err := d.path(key)
	if err != nil {
		return 0, err
	}
	if err := os.MkdirAll(filepath.Dir(dst), 0o750); err != nil {
		return 0, err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dst), ".upload-*")
	if err != nil {
		return 0, err
	}
	defer func() { _ = os.Remove(tmp.Name()) }()
	n, err := io.Copy(tmp, io.LimitReader(r, max+1))
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return 0, err
	}
	if n > max {
		return 0, apperr.New(domain.ErrTooLarge, "file is too large").WithMeta("maxBytes", max)
	}
	return n, os.Rename(tmp.Name(), dst)
}

func (d *Disk) Open(_ context.Context, key string) (io.ReadSeekCloser, error) {
	p, err := d.path(key)
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p) //nolint:gosec // G304: key validated against keyRe
	if errors.Is(err, os.ErrNotExist) {
		return nil, apperr.Wrap(domain.ErrNotFound, "file not found", err)
	}
	return f, err
}

func (d *Disk) Delete(_ context.Context, key string) error {
	p, err := d.path(key)
	if err != nil {
		return err
	}
	if err := os.Remove(p); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return nil
}
