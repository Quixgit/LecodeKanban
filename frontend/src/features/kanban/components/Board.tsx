import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DropAnimation,
  useDroppable,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Card } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { dragLift, ease, transition } from '@/shared/motion';
import { Button } from '@/shared/ui';
import { useBoardDnd, type DropResult } from '../hooks/useBoardDnd';
import { useBoardKeyboard } from '../hooks/useBoardKeyboard';
import {
  columnCounts,
  containerId,
  findContainer,
  parseContainer,
  type ColumnDef,
  type Containers,
  type LaneDef,
  type Swimlane,
} from '../model/board';
import { CardTile } from './CardTile';
import { ColumnCell } from './ColumnCell';
import { ColumnHeader, type ColumnAction } from './ColumnHeader';
import { DragContext } from './dragContext';
import { LaneHeader } from './LaneHeader';
import { QuickAdd, type QuickAddHandle } from './QuickAdd';

export interface BoardHandle {
  /** Opens quick-add in the container of the focused card, or the first one. */
  openQuickAdd: (container?: string) => void;
}

export interface BoardProps {
  cards: Card[];
  columns: ColumnDef[];
  lanes: LaneDef[];
  containers: Containers;
  swimlane: Swimlane;
  collapsed: string[];
  collapsedLanes: string[];
  onToggleLane: (key: string) => void;
  canEdit: boolean;
  canManageColumns: boolean;
  onToggleColumn: (key: string) => void;
  onColumnAction: (column: ColumnDef, action: ColumnAction) => void;
  onAddColumn: () => void;
  onOpen: (id: string) => void;
  onDrop: (r: DropResult) => void;
  quickAdd: {
    busy: boolean;
    projects?: { id: string; name: string; key: string }[];
    projectId?: string;
    onProjectChange?: (id: string) => void;
    onCreate: (container: string, title: string) => Promise<unknown>;
  };
}

/** Expanded columns share the width evenly (never narrower than this); collapsed ones are a slim rail. */
const COL_MIN = '17rem';
/** A column never grows past this, so a board with one or two columns does not stretch its cards across the screen. */
const COL_MAX = '26rem';
const COLLAPSED = '3.5rem';

const dropAnimation: DropAnimation = {
  duration: 260,
  easing: `cubic-bezier(${ease.join(',')})`,
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
};

export const Board = forwardRef<BoardHandle, BoardProps>(function Board(p, ref) {
  const { t } = useTranslation('kanban');
  const dnd = useBoardDnd(p.containers, p.swimlane, p.onDrop);
  const byId = useMemo(() => Object.fromEntries(p.cards.map((c) => [c.id, c])), [p.cards]);
  const counts = useMemo(() => columnCounts(dnd.containers), [dnd.containers]);
  const columnOrder = useMemo(
    () => p.columns.filter((c) => !p.collapsed.includes(c.key)).map((c) => c.key),
    [p.columns, p.collapsed],
  );
  const onKeyDown = useBoardKeyboard(dnd.containers, columnOrder, !!dnd.activeId, p.onOpen);
  const quickAdds = useRef<Record<string, QuickAddHandle | null>>({});

  useImperativeHandle(ref, () => ({
    openQuickAdd: (container) => {
      const first = containerId(p.lanes[0]?.key ?? '', columnOrder[0] ?? '');
      quickAdds.current[container && quickAdds.current[container] ? container : first]?.open();
    },
  }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const columnName = (container: string | undefined) =>
    container
      ? (p.columns.find((c) => c.key === parseContainer(container).column)?.name ?? '')
      : '';
  const title = (id: string | number) => byId[String(id)]?.title ?? '';
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      t('a11y.pickedUp', {
        title: title(active.id),
        column: columnName(findContainer(dnd.containers, String(active.id))),
      }),
    onDragOver: ({ active, over }) =>
      over
        ? t('a11y.over', {
            title: title(active.id),
            column: columnName(findContainer(dnd.containers, String(active.id))),
          })
        : t('a11y.outside', { title: title(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? t('a11y.dropped', {
            title: title(active.id),
            column: columnName(findContainer(dnd.containers, String(active.id))),
          })
        : t('a11y.cancelled', { title: title(active.id) }),
    onDragCancel: ({ active }) => t('a11y.cancelled', { title: title(active.id) }),
  };

  const active = dnd.activeId ? byId[dnd.activeId] : undefined;
  const [scrolled, setScrolled] = useState(false);
  const template = [
    ...p.columns.map((c) => (p.collapsed.includes(c.key) ? COLLAPSED : `minmax(${COL_MIN}, 1fr)`)),
    ...(p.canManageColumns ? ['auto'] : []),
  ].join(' ');
  const expanded = p.columns.filter((c) => !p.collapsed.includes(c.key)).length;
  const boardMinWidth = `calc(${expanded} * ${COL_MIN} + ${p.columns.length - expanded} * ${COLLAPSED} + ${Math.max(p.columns.length - 1, 0)} * 0.75rem)`;
  const boardMaxWidth = `calc(${expanded} * ${COL_MAX} + ${p.columns.length - expanded} * ${COLLAPSED} + ${Math.max(p.columns.length - 1, 0)} * 0.75rem + ${p.canManageColumns ? '9rem' : '0rem'})`;
  const openIn = (column: string) => {
    for (const lane of p.lanes) {
      const h = quickAdds.current[containerId(lane.key, column)];
      if (h) return h.open();
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={dnd.onDragStart}
      onDragOver={dnd.onDragOver}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('a11y.instructions') },
      }}
    >
      <DragContext.Provider value={!!dnd.activeId}>
        <div
          onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}
          onKeyDown={onKeyDown}
          className="max-h-[calc(100dvh-15rem)] min-h-[24rem] snap-x snap-proximity overflow-auto rounded-2xl"
        >
          <div
            className="flex w-full flex-col gap-6"
            style={{ minWidth: boardMinWidth, maxWidth: boardMaxWidth }}
          >
            <div
              role="presentation"
              data-stuck={scrolled}
              style={{ gridTemplateColumns: template }}
              className="sticky top-0 z-20 grid items-center gap-3 bg-bg pb-2 pt-1 transition-shadow duration-micro data-[stuck=true]:shadow-stuck"
            >
              {p.columns.map((col, i) => (
                <ColumnHeader
                  key={col.key}
                  column={col}
                  count={counts[col.key] ?? 0}
                  collapsed={p.collapsed.includes(col.key)}
                  onToggle={() => p.onToggleColumn(col.key)}
                  onAdd={p.canEdit ? () => openIn(col.key) : undefined}
                  manage={
                    p.canManageColumns
                      ? {
                          first: i === 0,
                          last: i === p.columns.length - 1,
                          onAction: (a) => p.onColumnAction(col, a),
                        }
                      : undefined
                  }
                />
              ))}
              {p.canManageColumns && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-text-muted"
                  onClick={p.onAddColumn}
                >
                  <Plus />
                  {t('column.add')}
                </Button>
              )}
            </div>

            {p.lanes.map((lane) => {
              const laneCollapsed = lane.kind !== 'none' && p.collapsedLanes.includes(lane.key);
              return (
                <section
                  key={lane.key}
                  aria-label={lane.title || undefined}
                  className="flex flex-col gap-2"
                >
                  {lane.kind !== 'none' && (
                    <LaneHeader
                      lane={lane}
                      collapsed={laneCollapsed}
                      onToggle={() => p.onToggleLane(lane.key)}
                      count={p.columns.reduce(
                        (n, c) => n + (dnd.containers[containerId(lane.key, c.key)]?.length ?? 0),
                        0,
                      )}
                    />
                  )}
                  <AnimatePresence initial={false}>
                    {!laneCollapsed && (
                      <motion.div
                        key="cells"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={transition.ui}
                        className="overflow-hidden"
                      >
                        <div
                          className="grid items-stretch gap-3"
                          style={{ gridTemplateColumns: template }}
                        >
                          {p.columns.map((col) => {
                            const id = containerId(lane.key, col.key);
                            const ids = dnd.containers[id] ?? [];
                            if (p.collapsed.includes(col.key)) {
                              return <ColumnCellDrop key={col.key} id={id} count={ids.length} />;
                            }
                            return (
                              <ColumnCell
                                key={col.key}
                                id={id}
                                ids={ids}
                                cards={byId}
                                status={col.status}
                                canEdit={p.canEdit}
                                overLimit={
                                  col.wipLimit !== null && (counts[col.key] ?? 0) > col.wipLimit
                                }
                                onOpen={p.onOpen}
                                footer={
                                  p.canEdit ? (
                                    <QuickAdd
                                      ref={(h) => {
                                        quickAdds.current[id] = h;
                                      }}
                                      busy={p.quickAdd.busy}
                                      projects={p.quickAdd.projects}
                                      projectId={p.quickAdd.projectId}
                                      onProjectChange={p.quickAdd.onProjectChange}
                                      onCreate={(title) => p.quickAdd.onCreate(id, title)}
                                    />
                                  ) : undefined
                                }
                              />
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={dropAnimation}>
          {active ? (
            <motion.div
              initial={{ scale: 1, rotate: 0 }}
              animate={{ scale: dragLift.scale, rotate: dragLift.rotate }}
              transition={transition.spring}
              className="cursor-grabbing rounded-lg shadow-drag"
            >
              <CardTile card={active} overlay className="w-[17rem] max-w-full" />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DragContext.Provider>
    </DndContext>
  );
});

/** A collapsed column still accepts drops (appended to the end). */
function ColumnCellDrop({ id, count }: { id: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { container: id } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-24 items-start justify-center rounded-2xl bg-surface-column pt-3 text-xs text-text-muted',
        isOver && 'ring-2 ring-inset ring-primary/40',
      )}
    >
      <span className="tabular">{count}</span>
    </div>
  );
}
