package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// Content returns a page's document (an empty one, version 0, until something is saved).
func (s *Service) Content(ctx context.Context, user, id uuid.UUID) (domain.Content, error) {
	sc, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return domain.Content{}, err
	}
	if err := sc.need(domain.CapView); err != nil {
		return domain.Content{}, err
	}
	c, ok, err := s.repo.Content(ctx, id)
	if err != nil {
		return domain.Content{}, err
	}
	if !ok {
		return domain.Content{NodeID: id, Doc: domain.EmptyDoc, UpdatedAt: sc.node.CreatedAt}, nil
	}
	return c, nil
}

// SaveContent stores the editor document. It is validated against the allow-list first, and the
// write only succeeds against the version the caller last saw: a stale writer gets
// wiki.content_conflict instead of silently overwriting somebody else's text.
func (s *Service) SaveContent(ctx context.Context, user, id uuid.UUID, doc []byte, baseVersion int) (domain.Content, error) {
	sc, err := s.loadNode(ctx, user, id, false)
	if err != nil {
		return domain.Content{}, err
	}
	if err := sc.need(domain.CapEdit); err != nil {
		return domain.Content{}, err
	}
	plain, err := domain.ValidateDoc(doc)
	if err != nil {
		return domain.Content{}, err
	}
	var saved domain.Content
	err = s.repo.InTx(ctx, func(r *repository.Repo) error {
		c, ok, err := r.SaveContent(ctx, id, doc, plain, user, baseVersion)
		if err != nil {
			return err
		}
		if !ok {
			return apperr.New(domain.ErrContentConflict, "the page was changed by somebody else")
		}
		saved = c
		return r.TouchNode(ctx, id)
	})
	return saved, err
}
