import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, type Variants } from 'framer-motion';
import { memo, useContext } from 'react';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { ease, transition } from '@/shared/motion';
import { DragContext } from './dragContext';
import { CardTile } from './CardTile';

/** New cards fade + slide in; removed cards collapse their height. Both off while dragging. */
const cardPresence: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: { opacity: 1, y: 0, height: 'auto', transition: transition.ui },
  exit: (dragging: boolean) =>
    dragging
      ? { opacity: 0, transition: { duration: 0 } }
      : { opacity: 0, height: 0, marginBottom: 0, transition: transition.ui },
};

interface Props {
  card: Card;
  container: string;
  disabled: boolean;
  onOpen: (id: string) => void;
  /** Virtualized lists measure each row. */
  measureRef?: (el: Element | null) => void;
  index?: number;
}

export const SortableCard = memo(function SortableCard({
  card,
  container,
  disabled,
  onOpen,
  measureRef,
  index,
}: Props) {
  const dragging = useContext(DragContext);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition: sortTransition,
    isDragging,
  } = useSortable({ id: card.id, data: { container }, disabled });
  return (
    <motion.li
      ref={measureRef}
      data-index={index}
      layout={false}
      variants={cardPresence}
      initial={dragging ? false : 'hidden'}
      animate="visible"
      exit="exit"
      className="list-none pb-2.5"
    >
      <CardTile
        ref={setNodeRef}
        card={card}
        data-card-id={card.id}
        data-container={container}
        style={{
          transform: CSS.Translate.toString(transform),
          transition: sortTransition ?? `transform 200ms cubic-bezier(${ease.join(',')})`,
        }}
        className={cn(
          !disabled && 'cursor-grab active:cursor-grabbing',
          // The slot the card will drop into: a soft dashed placeholder.
          isDragging &&
            'border-dashed border-primary/50 bg-primary-subtle shadow-none [&>*]:opacity-0',
        )}
        onClick={() => onOpen(card.id)}
        {...attributes}
        {...listeners}
        // Focusable for viewers too (arrow navigation, Enter to open), even when dragging is off.
        tabIndex={0}
      />
    </motion.li>
  );
});
