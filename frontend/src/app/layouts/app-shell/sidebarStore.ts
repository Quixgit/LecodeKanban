import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SidebarState {
  collapsed: boolean;
  /** Keys of expanded nav groups (e.g. "tasks"). */
  expanded: string[];
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  toggleGroup: (key: string) => void;
  expandGroup: (key: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: false,
      expanded: ['tasks'],
      toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleGroup: (key) =>
        set((s) => ({
          expanded: s.expanded.includes(key)
            ? s.expanded.filter((k) => k !== key)
            : [...s.expanded, key],
        })),
      expandGroup: (key) =>
        set((s) => (s.expanded.includes(key) ? s : { expanded: [...s.expanded, key] })),
    }),
    { name: 'lk-sidebar' },
  ),
);
