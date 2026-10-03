import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger, IconButton } from '@/shared/ui';
import type { WikiNode, WikiSpace } from '../model/tree';
import { SpaceTile } from './SpaceTile';

const VISIBLE_TAIL = 2;

/** Space › folders › page. Long paths collapse their middle into an overflow menu. */
export function Breadcrumbs({
  space,
  trail,
}: {
  space: Pick<WikiSpace, 'id' | 'name' | 'icon' | 'color'>;
  /** Ancestors from the root down to the node's parent. */
  trail: readonly WikiNode[];
}) {
  const { t } = useTranslation('wiki');
  const collapsed = trail.length > VISIBLE_TAIL + 1;
  const hidden = collapsed ? trail.slice(0, trail.length - VISIBLE_TAIL) : [];
  const shown = collapsed ? trail.slice(-VISIBLE_TAIL) : trail;
  const link =
    'max-w-[16ch] truncate rounded-md px-1.5 py-0.5 text-text-muted transition-colors duration-micro hover:bg-surface-sunken hover:text-text focus-visible:shadow-focus focus-visible:outline-none sm:max-w-[24ch]';
  const sep = <ChevronRight className="size-3.5 shrink-0 text-text-faint" aria-hidden />;

  return (
    <nav aria-label={t('breadcrumbs.label')}>
      <ol className="flex min-w-0 flex-wrap items-center gap-0.5 text-sm">
        <li className="flex items-center gap-1.5">
          <Link to={`/docs/s/${space.id}`} className={`${link} flex items-center gap-1.5`}>
            <SpaceTile icon={space.icon} color={space.color} size="xs" />
            <span className="truncate">{space.name}</span>
          </Link>
        </li>
        {hidden.length > 0 && (
          <li className="flex items-center gap-0.5">
            {sep}
            <Dropdown>
              <DropdownTrigger asChild>
                <IconButton label={t('breadcrumbs.more')} variant="ghost" size="sm">
                  <MoreHorizontal />
                </IconButton>
              </DropdownTrigger>
              <DropdownContent align="start" className="max-w-xs">
                {hidden.map((n) => (
                  <DropdownItem key={n.id} asChild>
                    <Link to={`/docs/p/${n.id}`}>
                      <span className="truncate">{n.title}</span>
                    </Link>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          </li>
        )}
        {shown.map((n) => (
          <li key={n.id} className="flex min-w-0 items-center gap-0.5">
            {sep}
            <Link to={`/docs/p/${n.id}`} className={link}>
              {n.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
