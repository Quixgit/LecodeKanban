import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';
import { useContext, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { STATUS_VAR } from '../model/board';
import { DragContext } from './dragContext';
import { SortableCard } from './SortableCard';

/** Above this many cards a cell renders only what is visible (with spacer padding). */
export const VIRTUAL_THRESHOLD = 60;

interface Props {
  id: string;
  ids: string[];
  cards: Record<string, Card>;
  canEdit: boolean;
  /** Highlight when the column is over its WIP limit. */
  overLimit: boolean;
  onOpen: (id: string) => void;
  footer?: ReactNode;
  /** Status of the column: tints the cell while a card is dragged over it. */
  status: keyof typeof STATUS_VAR;
}

function CardList({
  id,
  ids,
  cards,
  canEdit,
  onOpen,
}: Pick<Props, 'id' | 'ids' | 'cards' | 'canEdit' | 'onOpen'>) {
  const dragging = useContext(DragContext);
  return (
    <AnimatePresence initial={false} custom={dragging}>
      {ids.map((cid) => {
        const card = cards[cid];
        return card ? (
          <SortableCard key={cid} card={card} container={id} disabled={!canEdit} onOpen={onOpen} />
        ) : null;
      })}
    </AnimatePresence>
  );
}

function VirtualList({
  id,
  ids,
  cards,
  canEdit,
  onOpen,
  scrollEl,
}: Pick<Props, 'id' | 'ids' | 'cards' | 'canEdit' | 'onOpen'> & {
  /** The scrolling element, as state: a plain ref is still empty when the virtualizer first runs. */
  scrollEl: HTMLDivElement | null;
}) {
  const v = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollEl,
    estimateSize: () => 132,
    overscan: 8,
    getItemKey: (i) => ids[i]!,
  });
  const items = v.getVirtualItems();
  const top = items[0]?.start ?? 0;
  const bottom = v.getTotalSize() - (items.at(-1)?.end ?? 0);
  return (
    <>
      <li aria-hidden style={{ height: top }} />
      {items.map((item) => {
        const card = cards[ids[item.index]!];
        return card ? (
          <SortableCard
            key={item.key}
            card={card}
            container={id}
            disabled={!canEdit}
            onOpen={onOpen}
            index={item.index}
            measureRef={v.measureElement}
          />
        ) : null;
      })}
      <li aria-hidden style={{ height: bottom }} />
    </>
  );
}

/** One column inside one swimlane: a droppable, sortable, optionally virtualized card list. */
export function ColumnCell(p: Props) {
  const { t } = useTranslation('kanban');
  const { setNodeRef, isOver } = useDroppable({ id: p.id, data: { container: p.id } });
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const virtual = p.ids.length > VIRTUAL_THRESHOLD;
  return (
    <div
      ref={setNodeRef}
      style={isOver ? { backgroundColor: `rgb(var(${STATUS_VAR[p.status]}) / 0.08)` } : undefined}
      className={cn(
        'group/cell flex min-h-28 min-w-0 snap-start flex-col rounded-2xl bg-surface-column p-2 transition-colors duration-micro',
        p.overLimit && 'ring-1 ring-inset ring-danger/40',
      )}
    >
      <SortableContext id={p.id} items={p.ids} strategy={verticalListSortingStrategy}>
        {p.ids.length === 0 ? (
          <div className="flex min-h-16 flex-1 items-center justify-center rounded-xl border border-dashed border-border-strong px-2 text-center text-xs text-text-muted">
            {t('column.dropHere')}
          </div>
        ) : (
          // Only very long lists scroll inside the cell (virtualized); otherwise the board scrolls.
          <div
            ref={setScrollEl}
            className={cn(virtual && '-mr-1 max-h-[70dvh] overflow-y-auto pr-1')}
          >
            <ul role="list" className="flex flex-col">
              {virtual ? <VirtualList {...p} scrollEl={scrollEl} /> : <CardList {...p} />}
            </ul>
          </div>
        )}
      </SortableContext>
      <div className="mt-auto">{p.footer}</div>
    </div>
  );
}
