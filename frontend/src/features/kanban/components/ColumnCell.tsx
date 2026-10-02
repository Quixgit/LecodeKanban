import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AnimatePresence } from 'framer-motion';
import { useContext, useRef, type ReactNode } from 'react';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
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
  /** Max height of the scrollable list (lanes keep rows compact). */
  maxHeight: string;
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
  scrollRef,
}: Pick<Props, 'id' | 'ids' | 'cards' | 'canEdit' | 'onOpen'> & {
  scrollRef: React.RefObject<HTMLDivElement>;
}) {
  const v = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
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
  const { setNodeRef, isOver } = useDroppable({ id: p.id, data: { container: p.id } });
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtual = p.ids.length > VIRTUAL_THRESHOLD;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-24 flex-col rounded-xl p-2 transition-colors duration-micro',
        isOver ? 'bg-primary-subtle' : 'bg-surface-muted/60',
        p.overLimit && 'ring-1 ring-inset ring-danger/40',
      )}
    >
      <div
        ref={scrollRef}
        className="-mr-1 overflow-y-auto pr-1"
        style={{ maxHeight: p.maxHeight }}
      >
        <SortableContext id={p.id} items={p.ids} strategy={verticalListSortingStrategy}>
          <ul role="list" className="flex flex-col">
            {virtual ? <VirtualList {...p} scrollRef={scrollRef} /> : <CardList {...p} />}
          </ul>
        </SortableContext>
      </div>
      {p.footer}
    </div>
  );
}
