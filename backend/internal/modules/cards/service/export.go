package service

import (
	"context"

	"github.com/google/uuid"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/cards/domain"
	wsdomain "github.com/reliabilix/lecodekanban/backend/internal/modules/workspaces/domain"
)

// Export returns every card matching f for a spreadsheet download (the board cap applies; truncated says it was hit).
// It needs the export permission, which administrators have by default.
func (s *Service) Export(ctx context.Context, user, ws uuid.UUID, f domain.Filter) (views []View, truncated bool, err error) {
	if _, err := s.ws.Authorize(ctx, ws, user, wsdomain.PermExport); err != nil {
		return nil, false, err
	}
	cards, truncated, err := s.repo.Board(ctx, ws, f, s.today())
	if err != nil {
		return nil, false, err
	}
	views, err = s.present(ctx, cards)
	return views, truncated, err
}
