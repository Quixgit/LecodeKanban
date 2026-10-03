import { ChevronRight, Clock, Lock, Share2, Star, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { useNodeList } from '../hooks/useWiki';
import { NodeIcon } from './NodeIcon';

const SECTIONS: { kind: 'favorites' | 'recent' | 'shared' | 'mine'; icon: LucideIcon }[] = [
  { kind: 'favorites', icon: Star },
  { kind: 'recent', icon: Clock },
  { kind: 'shared', icon: Share2 },
  { kind: 'mine', icon: Lock },
];
const PREVIEW = 4;

/** Favorites, Recent, Shared with me and My private pages, above the tree. Empty ones hide. */
export function QuickSections({
  workspaceId,
  selectedId,
}: {
  workspaceId: string;
  selectedId?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border-subtle px-2 pb-2">
      {SECTIONS.map((s) => (
        <Section key={s.kind} workspaceId={workspaceId} selectedId={selectedId} {...s} />
      ))}
    </div>
  );
}

function Section({
  workspaceId,
  selectedId,
  kind,
  icon: Icon,
}: {
  workspaceId: string;
  selectedId?: string;
  kind: 'favorites' | 'recent' | 'shared' | 'mine';
  icon: LucideIcon;
}) {
  const { t } = useTranslation('wiki');
  const list = useNodeList(workspaceId, kind);
  const [open, setOpen] = useState(kind === 'favorites');
  const [all, setAll] = useState(false);
  const items = list.data ?? [];
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, PREVIEW);
  const id = `quick-${kind}`;
  return (
    <section aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-text-secondary transition-colors duration-micro hover:bg-surface-muted focus-visible:shadow-focus focus-visible:outline-none"
        >
          <ChevronRight
            className={cn(
              'size-3.5 stroke-[1.75] transition-transform duration-ui',
              open && 'rotate-90',
            )}
            aria-hidden
          />
          <Icon className="size-4 stroke-[1.6] text-text-muted" aria-hidden />
          <span className="flex-1 text-left">{t(`sections.${kind}`)}</span>
          <span className="tabular text-xs text-text-muted">{items.length}</span>
        </button>
      </h3>
      {open && (
        <ul id={id} className="flex flex-col pl-3">
          {shown.map((n) => (
            <li key={n.id}>
              <Link
                to={`/docs/p/${n.id}`}
                aria-current={n.id === selectedId ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center gap-2 rounded-lg px-2 text-base transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                  n.id === selectedId
                    ? 'bg-primary-subtle font-medium text-primary-ink'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text',
                )}
              >
                <NodeIcon node={n} />
                <span className="truncate">{n.title}</span>
              </Link>
            </li>
          ))}
          {items.length > PREVIEW && (
            <li>
              <button
                type="button"
                onClick={() => setAll((a) => !a)}
                className="h-7 rounded-lg px-2 text-xs text-text-muted hover:text-text focus-visible:shadow-focus focus-visible:outline-none"
              >
                {all ? t('sections.less') : t('sections.more', { count: items.length - PREVIEW })}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
