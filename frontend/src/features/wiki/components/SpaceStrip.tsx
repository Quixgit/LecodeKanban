import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { IconButton, Tooltip } from '@/shared/ui';
import type { WikiSpace } from '../api/wikiApi';
import { SPACE_DROP_PREFIX, useDropState } from './dropContext';
import { SpaceTile } from './SpaceTile';

/** One tile per space: switches the tree and accepts dropped nodes (moves them to the root). */
export function SpaceStrip({
  spaces,
  activeId,
  canCreate,
  onCreate,
}: {
  spaces: readonly WikiSpace[];
  activeId?: string;
  canCreate: boolean;
  onCreate: () => void;
}) {
  const { t } = useTranslation('wiki');
  return (
    <nav
      aria-label={t('spaces.label')}
      className="flex max-h-28 shrink-0 flex-wrap items-center gap-1.5 overflow-y-auto px-3 py-2"
    >
      {spaces.map((s) => (
        <SpaceButton key={s.id} space={s} active={s.id === activeId} />
      ))}
      {canCreate && (
        <Tooltip content={t('spaces.create')}>
          <IconButton
            label={t('spaces.create')}
            variant="outline"
            className="!size-9 shrink-0 !rounded-xl border-dashed"
            onClick={onCreate}
          >
            <Plus />
          </IconButton>
        </Tooltip>
      )}
    </nav>
  );
}

function SpaceButton({ space, active }: { space: WikiSpace; active: boolean }) {
  const drop = useDroppable({ id: `${SPACE_DROP_PREFIX}${space.id}`, data: { space } });
  const state = useDropState();
  const over = state?.overId === `${SPACE_DROP_PREFIX}${space.id}` ? state : null;
  return (
    <Tooltip content={space.name}>
      <Link
        ref={drop.setNodeRef}
        to={`/docs/s/${space.id}`}
        aria-label={space.name}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'shrink-0 rounded-xl p-0.5 outline-none transition-shadow duration-micro focus-visible:shadow-focus',
          active ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-border-strong',
          over &&
            (over.valid
              ? 'bg-primary-soft ring-2 ring-primary'
              : 'cursor-not-allowed ring-2 ring-danger'),
        )}
      >
        <SpaceTile icon={space.icon} color={space.color} />
      </Link>
    </Tooltip>
  );
}
