package service

import (
	"context"
	"strings"
	"time"

	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/domain"
	"github.com/reliabilix/lecodekanban/backend/internal/modules/wiki/repository"
	"github.com/reliabilix/lecodekanban/backend/internal/platform/apperr"
)

// purgeRoot permanently removes a trash root and its subtree. Pages below it that were trashed on
// their own and still inherit their visibility would lose it with the parent link (they survive,
// restorable at the root), so the effective visibility is written onto them first: a purge must
// never turn a private page into a workspace-visible one.
func purgeRoot(ctx context.Context, r *repository.Repo, root domain.Node) error {
	sp, err := r.Space(ctx, root.SpaceID)
	if err != nil {
		return err
	}
	ix, err := loadIndex(ctx, r, sp)
	if err != nil {
		return err
	}
	for _, n := range ix.order {
		independent := n.ID != root.ID && n.Deleted() && n.TrashRootID != nil && *n.TrashRootID == n.ID
		if !independent || n.Visibility != "" || !strings.HasPrefix(n.Path, root.Path) {
			continue
		}
		aud := domain.AudienceOf(ix.chain(n))
		wr := n.WorkspaceRole
		if aud.Visibility == domain.Workspace {
			wr = aud.WorkspaceRole
		}
		if _, err := r.SetNodeVisibility(ctx, n.ID, aud.Visibility, wr); err != nil {
			return err
		}
	}
	return r.PurgeTrashRoot(ctx, root.ID)
}

// Maintenance runs the wiki's periodic cleanup (needs no authorization context).
type Maintenance struct {
	repo *repository.Repo
	now  func() time.Time
}

func NewMaintenance(repo *repository.Repo) *Maintenance {
	return &Maintenance{repo: repo, now: time.Now}
}

// PurgeExpired permanently removes trash older than the retention period and returns how many
// trash roots went.
func (m *Maintenance) PurgeExpired(ctx context.Context) (int, error) {
	roots, err := m.repo.ExpiredTrashRoots(ctx, m.now().Add(-domain.TrashRetention))
	if err != nil {
		return 0, err
	}
	purged := 0
	for _, root := range roots {
		err := m.repo.InTx(ctx, func(r *repository.Repo) error { return purgeRoot(ctx, r, root) })
		if err != nil {
			return purged, err
		}
		purged++
	}
	return purged, nil
}

// PurgeExpired is Maintenance.PurgeExpired for callers that hold the service.
func (s *Service) PurgeExpired(ctx context.Context) (int, error) {
	return (&Maintenance{repo: s.repo, now: s.now}).PurgeExpired(ctx)
}

// expired reports whether a trash root is past the restore window, which is enforced on restore
// independently of when the cleanup job runs.
func (s *Service) expired(n domain.Node) bool {
	return n.DeletedAt != nil && n.DeletedAt.Before(s.now().Add(-domain.TrashRetention))
}

var errGone = func() error { return apperr.New(domain.ErrNotFound, "wiki element not found") }
