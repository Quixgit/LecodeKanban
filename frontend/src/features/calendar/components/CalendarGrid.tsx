import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { useLanguage } from '@/shared/i18n';
import { addDays, sameMonth, visibleDays, parseKey, type CalendarMode } from '../model/dates';
import { ChipBody } from './CalendarChip';
import { DayCell } from './DayCell';
import { Unscheduled } from './Unscheduled';

interface Props {
  anchor: string;
  mode: CalendarMode;
  today: string;
  cards: Card[];
  canEdit: boolean;
  onOpen: (id: string) => void;
  onZoom: (day: string) => void;
  onCreate?: (day: string) => void;
  onReschedule: (card: Card, day: string) => void;
  /** 0 Sunday, 1 Monday (the workspace's choice). */
  weekStart?: 0 | 1;
}

const LIMIT = { month: 3, week: 8, day: 500 } as const;

/** The day cells plus drag and drop: drop a card on a day to change its due date. */
export function CalendarGrid({
  anchor,
  mode,
  today,
  cards,
  canEdit,
  onOpen,
  onZoom,
  onCreate,
  onReschedule,
  weekStart = 1,
}: Props) {
  const { t } = useTranslation('calendar');
  const { language } = useLanguage();
  const [active, setActive] = useState<Card | null>(null);
  const days = useMemo(() => visibleDays(anchor, mode, weekStart), [anchor, mode, weekStart]);

  const { byDay, unscheduled } = useMemo(() => {
    const map = new Map<string, Card[]>();
    const none: Card[] = [];
    for (const c of cards) {
      if (!c.dueDate) {
        if (c.status !== 'done') none.push(c);
        continue;
      }
      const list = map.get(c.dueDate);
      if (list) list.push(c);
      else map.set(c.dueDate, [c]);
    }
    return { byDay: map, unscheduled: none };
  }, [cards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const dayLabel = (key: string) =>
    new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(parseKey(key));

  const onDragStart = ({ active: a }: DragStartEvent) => setActive(byId.get(String(a.id)) ?? null);
  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    const card = byId.get(String(a.id));
    if (card && over) onReschedule(card, String(over.id));
  };

  // 2024-01-01 is a Monday and 2023-12-31 a Sunday: weekday names without hard-coding them per language.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(
      parseKey(weekStart === 0 ? addDays('2023-12-31', i) : addDays('2024-01-01', i)),
    ),
  );
  const cols = mode === 'day' ? 'grid-cols-1' : 'grid-cols-7';

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActive(null)}
      accessibility={{
        announcements: {
          onDragStart: ({ active: a }) =>
            t('a11y.pickedUp', { title: byId.get(String(a.id))?.title }),
          onDragOver: ({ active: a, over }) =>
            over
              ? t('a11y.over', {
                  title: byId.get(String(a.id))?.title,
                  date: dayLabel(String(over.id)),
                })
              : undefined,
          onDragEnd: ({ active: a, over }) =>
            over
              ? t('a11y.dropped', {
                  title: byId.get(String(a.id))?.title,
                  date: dayLabel(String(over.id)),
                })
              : t('a11y.cancelled', { title: byId.get(String(a.id))?.title }),
          onDragCancel: ({ active: a }) =>
            t('a11y.cancelled', { title: byId.get(String(a.id))?.title }),
        },
        screenReaderInstructions: { draggable: t('a11y.instructions') },
      }}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="overflow-x-auto rounded-xl border border-border-subtle bg-surface">
          <div role="grid" className="min-w-[44rem]">
            {mode !== 'day' && (
              <div role="row" className={`grid ${cols} border-b border-border-subtle`}>
                {weekdays.map((w) => (
                  <div
                    key={w}
                    role="columnheader"
                    className="px-2 py-2 text-xs font-medium uppercase tracking-wide text-text-muted"
                  >
                    {w}
                  </div>
                ))}
              </div>
            )}
            <div role="rowgroup" className={`grid ${cols} border-l-0`}>
              {days.map((d) => (
                <DayCell
                  key={d}
                  day={d}
                  cards={byDay.get(d) ?? []}
                  today={today}
                  dimmed={mode === 'month' && !sameMonth(d, anchor)}
                  limit={LIMIT[mode]}
                  tall={mode !== 'month'}
                  canEdit={canEdit}
                  onOpen={onOpen}
                  onZoom={onZoom}
                  onCreate={onCreate}
                />
              ))}
            </div>
          </div>
        </div>
        <Unscheduled cards={unscheduled} canEdit={canEdit} onOpen={onOpen} />
      </div>
      <DragOverlay dropAnimation={null}>
        {active && <ChipBody card={active} overdue={false} dragging />}
      </DragOverlay>
    </DndContext>
  );
}
