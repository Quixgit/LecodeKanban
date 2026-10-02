import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { fadeUp } from '@/shared/motion';
import { Button, Checkbox, IconButton, ProgressBar, toast } from '@/shared/ui';
import type { ChecklistItem } from '../api/drawerApi';
import { useChecklist } from '../hooks/useDrawerData';

function Item({
  item,
  editable,
  onToggle,
  onRename,
  onDelete,
  onNudge,
}: {
  item: ChecklistItem;
  editable: boolean;
  onToggle: (done: boolean) => void;
  onRename: (text: string) => void;
  onDelete: () => void;
  onNudge: (dir: -1 | 1) => void;
}) {
  const { t } = useTranslation('card');
  const [draft, setDraft] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !editable,
  });
  const commit = () => {
    if (draft !== null && draft.trim() && draft.trim() !== item.text) onRename(draft.trim());
    setDraft(null);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(null);
    }
  };
  return (
    <motion.li
      ref={setNodeRef}
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'group/item flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-muted/60',
        isDragging && 'z-10 bg-surface shadow-md',
      )}
      onKeyDown={(e) => {
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          onNudge(e.key === 'ArrowUp' ? -1 : 1);
        }
      }}
    >
      {editable && (
        <button
          type="button"
          className="cursor-grab text-text-faint opacity-0 transition-opacity focus-visible:opacity-100 group-hover/item:opacity-100"
          aria-label={t('checklist.reorder', { text: item.text })}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <Checkbox
        checked={item.done}
        disabled={!editable}
        aria-label={item.text}
        onCheckedChange={(v) => onToggle(v === true)}
      />
      {draft !== null ? (
        <input
          autoFocus
          value={draft}
          maxLength={300}
          aria-label={t('checklist.edit')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 rounded bg-surface px-1 text-base text-text ring-1 ring-primary/50 focus:outline-none"
        />
      ) : (
        <span
          className={cn(
            'min-w-0 flex-1 text-base',
            item.done ? 'text-text-muted line-through' : 'text-text',
            editable && 'cursor-text',
          )}
          onDoubleClick={() => editable && setDraft(item.text)}
        >
          {item.text}
        </span>
      )}
      {editable && (
        <IconButton
          variant="ghost"
          size="sm"
          className="opacity-0 focus-visible:opacity-100 group-hover/item:opacity-100"
          label={t('checklist.delete', { text: item.text })}
          onClick={onDelete}
        >
          <Trash2 />
        </IconButton>
      )}
    </motion.li>
  );
}

/** Checklist: checked share drives the card's progress (ADR 0010). */
export function Checklist({
  cardId,
  workspaceId,
  editable,
}: {
  cardId: string;
  workspaceId: string;
  editable: boolean;
}) {
  const { t } = useTranslation('card');
  const errorText = useErrorText();
  const { list, add, update, remove } = useChecklist(cardId, workspaceId);
  const [text, setText] = useState('');
  const items = list.data ?? [];
  const done = items.filter((i) => i.done).length;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const fail = (e: unknown) => toast.error(errorText(e));

  const reorder = (id: string, to: number) => {
    const from = items.findIndex((i) => i.id === id);
    if (from < 0 || to < 0 || to >= items.length || from === to) return;
    const next = arrayMove(items, from, to);
    update.mutate(
      { id, patch: { move: { afterId: next[to - 1]?.id, beforeId: next[to + 1]?.id } } },
      { onError: fail },
    );
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id)
      reorder(
        String(active.id),
        items.findIndex((i) => i.id === over.id),
      );
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    add.mutate(value, { onSuccess: () => setText(''), onError: fail });
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <ProgressBar
            value={(done / items.length) * 100}
            size="sm"
            label={t('checklist.progress', { done, total: items.length })}
          />
          <span className="tabular shrink-0 text-xs text-text-muted">
            {done}/{items.length}
          </span>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {items.map((item, i) => (
                <Item
                  key={item.id}
                  item={item}
                  editable={editable}
                  onToggle={(v) =>
                    update.mutate({ id: item.id, patch: { done: v } }, { onError: fail })
                  }
                  onRename={(v) =>
                    update.mutate({ id: item.id, patch: { text: v } }, { onError: fail })
                  }
                  onDelete={() => remove.mutate(item.id, { onError: fail })}
                  onNudge={(dir) => reorder(item.id, i + dir)}
                />
              ))}
            </AnimatePresence>
          </ul>
        </SortableContext>
      </DndContext>
      {editable && (
        <form onSubmit={submit} className="flex items-center gap-2">
          <input
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('checklist.add')}
            aria-label={t('checklist.add')}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-base text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            loading={add.isPending}
            disabled={!text.trim()}
          >
            <Plus />
            {t('checklist.addButton')}
          </Button>
        </form>
      )}
    </div>
  );
}
