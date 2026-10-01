import type { RowSelectionState, SortingState } from '@tanstack/react-table';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { statusToSlug, type Card, type TaskStatus } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { collapse, fadeUp } from '@/shared/motion';
import { Button, Card as Panel, EmptyState, IconButton, StatusTag } from '@/shared/ui';
import { TaskTable } from './TaskTable';

interface Props {
  status: TaskStatus;
  count: number | undefined;
  cards: Card[];
  loading: boolean;
  collapsed: boolean;
  onToggle: () => void;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  selection: RowSelectionState;
  onSelectionChange: (s: RowSelectionState) => void;
  canEdit: boolean;
  onEdit: (c: Card) => void;
  onMove: (c: Card, s: TaskStatus) => void;
  onDelete: (c: Card) => void;
  /** Shown on the grouped overview; hidden on the single-status page. */
  showViewAll: boolean;
  footer?: React.ReactNode;
  virtual?: boolean;
  search: string;
}

/** One status section of the Tasks list: tag, count, collapse toggle, "View All" and the table. */
export function StatusGroup(p: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  const label = t(`common:status.${p.status}`);
  return (
    <motion.section variants={fadeUp} aria-label={label}>
      <Panel className="p-4">
        <header className={cn('flex items-center gap-2', !p.collapsed && 'mb-4')}>
          <StatusTag status={p.status} />
          <span className="tabular flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-md text-text-secondary">
            {p.count ?? '–'}
          </span>
          <IconButton
            variant="ghost"
            size="sm"
            label={p.collapsed ? t('expand', { status: label }) : t('collapse', { status: label })}
            aria-expanded={!p.collapsed}
            onClick={p.onToggle}
          >
            <ChevronDown
              className={cn(
                'transition-transform duration-ui ease-out',
                !p.collapsed && 'rotate-180',
              )}
            />
          </IconButton>
          {p.showViewAll && (
            <Button asChild variant="secondary" size="sm" className="ml-auto">
              <Link to={`/tasks/${statusToSlug(p.status)}${p.search}`}>
                {t('viewAll')}
                <ArrowUpRight />
              </Link>
            </Button>
          )}
        </header>
        <AnimatePresence initial={false}>
          {!p.collapsed && (
            <motion.div
              key="body"
              variants={collapse}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              className="overflow-hidden"
            >
              {!p.loading && p.cards.length === 0 ? (
                <EmptyState className="py-8" title={t('empty.group')} />
              ) : (
                <TaskTable
                  status={p.status}
                  cards={p.cards}
                  loading={p.loading}
                  skeletonRows={3}
                  sorting={p.sorting}
                  onSortingChange={p.onSortingChange}
                  selection={p.selection}
                  onSelectionChange={p.onSelectionChange}
                  canEdit={p.canEdit}
                  onEdit={p.onEdit}
                  onMove={p.onMove}
                  onDelete={p.onDelete}
                  virtual={p.virtual}
                />
              )}
              {p.footer}
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </motion.section>
  );
}
