import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Swimlane } from './board';

export type TasksView = 'list' | 'kanban' | 'calendar';

interface BoardState {
  view: TasksView;
  swimlane: Swimlane;
  /** Collapsed column keys (column ids or statuses). */
  collapsed: string[];
  /** Collapsed swimlane keys. */
  collapsedLanes: string[];
  /** Project preselected by quick-add on the all-projects board. */
  quickAddProjectId?: string;
  setView: (v: TasksView) => void;
  setSwimlane: (s: Swimlane) => void;
  toggleColumn: (key: string) => void;
  toggleLane: (key: string) => void;
  setQuickAddProject: (id: string) => void;
}

/** Board UI preferences, remembered per browser. */
export const useBoardStore = create<BoardState>()(
  persist(
    (set) => ({
      view: 'list',
      swimlane: 'none',
      collapsed: [],
      collapsedLanes: [],
      setView: (view) => set({ view }),
      setSwimlane: (swimlane) => set({ swimlane }),
      toggleColumn: (key) =>
        set((s) => ({
          collapsed: s.collapsed.includes(key)
            ? s.collapsed.filter((k) => k !== key)
            : [...s.collapsed, key],
        })),
      toggleLane: (key) =>
        set((s) => ({
          collapsedLanes: s.collapsedLanes.includes(key)
            ? s.collapsedLanes.filter((k) => k !== key)
            : [...s.collapsedLanes, key],
        })),
      setQuickAddProject: (quickAddProjectId) => set({ quickAddProjectId }),
    }),
    { name: 'lk-kanban' },
  ),
);
