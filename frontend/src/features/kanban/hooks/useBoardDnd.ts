import type { DragEndEvent, DragOverEvent, DragStartEvent, Over } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useEffect, useRef, useState } from 'react';
import { holdRealtime } from '@/features/realtime';
import {
  findContainer,
  moveItem,
  parseContainer,
  type Containers,
  type Swimlane,
} from '../model/board';
import { canChangeLane } from '../model/move';

export interface DropResult {
  cardId: string;
  from: string;
  to: string;
  /** Final order of the target container. */
  targetIds: string[];
  /** Target container's order before the drag. */
  originalIds: string[];
}

/** Container an `over` target belongs to: a cell itself, or the cell of the card under the pointer. */
function containerOf(containers: Containers, over: Over): string | undefined {
  const fromData = over.data.current?.container as string | undefined;
  if (fromData && fromData in containers) return fromData;
  const id = String(over.id);
  return id in containers ? id : findContainer(containers, id);
}

/**
 * Multi-container drag state: while dragging, cards move between local containers (so the
 * placeholder gap follows the pointer); the server order is re-adopted once the drag ends.
 */
export function useBoardDnd(
  server: Containers,
  swimlane: Swimlane,
  onDrop: (r: DropResult) => void,
) {
  const [containers, setContainers] = useState(server);
  const [activeId, setActiveId] = useState<string | null>(null);
  const snapshot = useRef<{ containers: Containers; from: string } | null>(null);
  const release = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!activeId) setContainers(server);
  }, [server, activeId]);
  useEffect(() => () => release.current?.(), []);

  const finish = () => {
    setActiveId(null);
    snapshot.current = null;
    release.current?.();
    release.current = null;
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const from = findContainer(containers, String(active.id));
    if (!from) return;
    snapshot.current = { containers, from };
    setActiveId(String(active.id));
    release.current = holdRealtime();
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const id = String(active.id);
    const from = findContainer(containers, id);
    const to = containerOf(containers, over);
    if (!from || !to || from === to) return;
    if (!canChangeLane(swimlane, parseContainer(from).lane, parseContainer(to).lane)) return;
    const target = containers[to]!;
    const overIndex = target.indexOf(String(over.id));
    let index = target.length;
    if (overIndex >= 0) {
      const translated = active.rect.current.translated;
      const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
      index = overIndex + (below ? 1 : 0);
    }
    setContainers((c) => moveItem(c, id, to, index));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const snap = snapshot.current;
    const id = String(active.id);
    if (!snap || !over) {
      if (snap) setContainers(snap.containers);
      finish();
      return;
    }
    let final = containers;
    const container = findContainer(final, id);
    const overContainer = containerOf(final, over);
    if (container && overContainer === container && over.id !== active.id) {
      const ids = final[container]!;
      const from = ids.indexOf(id);
      const to = ids.indexOf(String(over.id));
      if (from >= 0 && to >= 0) final = { ...final, [container]: arrayMove(ids, from, to) };
    }
    setContainers(final);
    finish();
    if (!container) return;
    onDrop({
      cardId: id,
      from: snap.from,
      to: container,
      targetIds: final[container]!,
      originalIds: snap.containers[container] ?? [],
    });
  };

  const onDragCancel = () => {
    if (snapshot.current) setContainers(snapshot.current.containers);
    finish();
  };

  return { containers, activeId, onDragStart, onDragOver, onDragEnd, onDragCancel };
}
