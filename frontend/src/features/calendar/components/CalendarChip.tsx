import { useDraggable } from '@dnd-kit/core';
import { memo } from 'react';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { priorityTone, toneClasses } from '@/shared/ui';

interface ChipProps {
  card: Card;
  overdue: boolean;
  onOpen: (id: string) => void;
  draggable: boolean;
  /** Full-width row (day view / unscheduled list) instead of a compact chip. */
  roomy?: boolean;
}

/** Presentation only; also rendered inside the drag overlay. */
export function ChipBody({
  card,
  overdue,
  roomy,
  dragging,
}: Pick<ChipProps, 'card' | 'overdue' | 'roomy'> & { dragging?: boolean }) {
  return (
    <span
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-md border border-border-subtle bg-surface px-1.5 text-left text-xs shadow-xs',
        roomy ? 'min-h-9 py-1.5 text-sm' : 'h-6',
        card.status === 'done' && 'opacity-60',
        dragging && 'rotate-1 scale-[1.02] shadow-lg',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-full',
          toneClasses[priorityTone[card.priority]].fill,
        )}
      />
      <span className="tabular shrink-0 text-text-muted">{card.key}</span>
      <span
        className={cn(
          'truncate text-text',
          card.status === 'done' && 'line-through',
          overdue && 'font-medium text-danger-ink',
        )}
      >
        {card.title}
      </span>
    </span>
  );
}

export const CalendarChip = memo(function CalendarChip({
  card,
  overdue,
  onOpen,
  draggable,
  roomy,
}: ChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    disabled: !draggable,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(card.id)}
      className={cn(
        'block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
        draggable && 'cursor-grab touch-none active:cursor-grabbing',
        isDragging && 'opacity-30',
      )}
      {...attributes}
      {...listeners}
    >
      <ChipBody card={card} overdue={overdue} roomy={roomy} />
    </button>
  );
});
