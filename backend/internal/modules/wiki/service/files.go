package service

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"path"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// sanitizeFileName keeps a display-safe base name: no paths, no control characters, <= 255 bytes.
func sanitizeFileName(name string) string {
	name = path.Base(strings.ReplaceAll(name, `\`, "/"))
	name = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == '"' {
			return -1
		}
		return r
	}, name)
	name = strings.TrimSpace(name)
	for len(name) > 255 {
		_, size := utf8.DecodeLastRuneInString(name)
		name = name[:len(name)-size]
	}
	if name == "" || name == "." || name == "/" {
		return "file"
	}
	return name
}

// UploadFile stores a file for a page (editors only). The content type is sniffed from the bytes,
// never taken from the client.
func (s *Service) UploadFile(ctx context.Context, user, nodeID uuid.UUID, name string, body io.Reader) (domain.File, error) {
	if s.storage == nil {
		return domain.File{}, apperr.New(apperr.Unavailable, "uploads are not configured")
	}
	sc, err := s.loadNode(ctx, user, nodeID, false)
	if err != nil {
		return domain.File{}, err
	}
	if err := sc.need(domain.CapEdit); err != nil {
		return domain.File{}, err
	}
	n, err := s.repo.CountFiles(ctx, nodeID)
	if err != nil {
		return domain.File{}, err
	}
	if n >= domain.MaxFilesPerPage {
		return domain.File{}, apperr.New(domain.ErrTooManyFiles, "too many files on this page").WithMeta("max", domain.MaxFilesPerPage)
	}
	br := bufio.NewReaderSize(body, 512)
	head, _ := br.Peek(512)
	ctype := http.DetectContentType(head)
	id := uuid.New()
	key := id.String()[:2] + "/" + id.String()
	size, err := s.storage.Put(ctx, key, br, s.maxBytes)
	if err != nil {
		return domain.File{}, err
	}
	f, err := s.repo.CreateFile(ctx, domain.File{WorkspaceID: sc.node.WorkspaceID, NodeID: nodeID, Name: sanitizeFileName(name),
		ContentType: ctype, Size: size, StorageKey: key, UploadedBy: &user})
	if err != nil {
		_ = s.storage.Delete(ctx, key)
		return domain.File{}, err
	}
	return f, nil
}

// OpenFile returns a file and its bytes for anybody who can read the page it belongs to.
func (s *Service) OpenFile(ctx context.Context, user, id uuid.UUID) (domain.File, io.ReadSeekCloser, error) {
	if s.storage == nil {
		return domain.File{}, nil, apperr.New(apperr.Unavailable, "uploads are not configured")
	}
	f, err := s.repo.File(ctx, id)
	if err != nil {
		return domain.File{}, nil, err
	}
	sc, err := s.loadNode(ctx, user, f.NodeID, false)
	if err != nil {
		return domain.File{}, nil, apperr.New(domain.ErrNotFound, "file not found")
	}
	if err := sc.need(domain.CapView); err != nil {
		return domain.File{}, nil, apperr.New(domain.ErrNotFound, "file not found")
	}
	rc, err := s.storage.Open(ctx, f.StorageKey)
	if err != nil {
		return domain.File{}, nil, err
	}
	return f, rc, nil
}
