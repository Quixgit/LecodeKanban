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
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
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

const COL_W = 'w-[296px]';
const COLLAPSED_W = 'w-14';

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
  const lanesMaxHeight = p.lanes.length > 1 ? '28rem' : 'calc(100dvh - 19rem)';

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
        <div className="overflow-x-auto pb-3" onKeyDown={onKeyDown}>
          <div className="inline-flex min-w-full flex-col gap-3">
            <div className="flex gap-3" role="presentation">
              {p.columns.map((col, i) => {
                const collapsed = p.collapsed.includes(col.key);
                return (
                  <div
                    key={col.key}
                    className={cn(
                      'shrink-0 transition-[width] duration-ui ease-out',
                      collapsed ? COLLAPSED_W : COL_W,
                    )}
                  >
                    <ColumnHeader
                      column={col}
                      count={counts[col.key] ?? 0}
                      collapsed={collapsed}
                      onToggle={() => p.onToggleColumn(col.key)}
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
                  </div>
                );
              })}
              {p.canManageColumns && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-text-muted"
                  onClick={p.onAddColumn}
                >
                  <Plus />
                  {t('column.add')}
                </Button>
              )}
            </div>

            {p.lanes.map((lane) => (
              <section
                key={lane.key}
                aria-label={lane.title || undefined}
                className="flex flex-col gap-2"
              >
                {lane.kind !== 'none' && (
                  <LaneHeader
                    lane={lane}
                    count={p.columns.reduce(
                      (n, c) => n + (dnd.containers[containerId(lane.key, c.key)]?.length ?? 0),
                      0,
                    )}
                  />
                )}
                <div className="flex gap-3">
                  {p.columns.map((col) => {
                    const id = containerId(lane.key, col.key);
                    const ids = dnd.containers[id] ?? [];
                    if (p.collapsed.includes(col.key)) {
                      return <CollapsedCell key={col.key} id={id} count={ids.length} />;
                    }
                    return (
                      <div key={col.key} className={cn('shrink-0', COL_W)}>
                        <ColumnCell
                          id={id}
                          ids={ids}
                          cards={byId}
                          canEdit={p.canEdit}
                          overLimit={col.wipLimit !== null && (counts[col.key] ?? 0) > col.wipLimit}
                          onOpen={p.onOpen}
                          maxHeight={lanesMaxHeight}
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
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
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
              <CardTile card={active} overlay className={cn(COL_W, 'max-w-full')} />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DragContext.Provider>
    </DndContext>
  );
});

function CollapsedCell({ id, count }: { id: string; count: number }) {
  return (
    <div className={cn('shrink-0', COLLAPSED_W)}>
      <ColumnCellDrop id={id} count={count} />
    </div>
  );
}

/** A collapsed column still accepts drops (appended to the end). */
function ColumnCellDrop({ id, count }: { id: string; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { container: id } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-24 items-start justify-center rounded-xl pt-3 text-xs text-text-muted',
        isOver ? 'bg-primary-subtle' : 'bg-surface-muted/60',
      )}
    >
      <span className="tabular">{count}</span>
    </div>
  );
}
