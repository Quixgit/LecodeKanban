import { useCallback, type KeyboardEvent } from 'react';
import { parseContainer, type Containers } from '../model/board';

function focusCard(id: string | undefined) {
  if (!id) return;
  const el = document.querySelector<HTMLElement>(`[data-card-id="${CSS.escape(id)}"]`);
  el?.focus();
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/**
 * Arrow keys move focus between cards (↑↓ within a column, ←→ to the neighbouring column of the
 * same swimlane); Enter or E opens the focused card. Space is left to dnd-kit (pick up / drop).
 */
export function useBoardKeyboard(
  containers: Containers,
  columnOrder: string[],
  dragging: boolean,
  onOpen: (id: string) => void,
) {
  return useCallback(
    (e: KeyboardEvent) => {
      if (dragging || e.altKey || e.metaKey || e.ctrlKey) return;
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-card-id]');
      if (!el || el !== e.target) return;
      const id = el.dataset.cardId!;
      const container = el.dataset.container!;
      const ids = containers[container] ?? [];
      const i = ids.indexOf(id);
      const { lane, column } = parseContainer(container);
      const step = (dir: 1 | -1) => {
        for (
          let c = columnOrder.indexOf(column) + dir;
          c >= 0 && c < columnOrder.length;
          c += dir
        ) {
          const next = containers[`${lane}::${columnOrder[c]}`];
          if (next?.length) return next[Math.min(i, next.length - 1)];
        }
        return undefined;
      };
      let target: string | undefined;
      switch (e.key) {
        case 'ArrowDown':
          target = ids[i + 1];
          break;
        case 'ArrowUp':
          target = ids[i - 1];
          break;
        case 'ArrowRight':
          target = step(1);
          break;
        case 'ArrowLeft':
          target = step(-1);
          break;
        case 'Enter':
        case 'e':
        case 'E':
          e.preventDefault();
          onOpen(id);
          return;
        default:
          return;
      }
      e.preventDefault();
      focusCard(target);
    },
    [containers, columnOrder, dragging, onOpen],
  );
}
