import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarLayout = 'classic' | 'rail';

interface SidebarState {
  /** classic: one column of labelled links. rail: icon strip, then a menu for the chosen section. */
  layout: SidebarLayout;
  setLayout: (v: SidebarLayout) => void;
  collapsed: boolean;
  /** Keys of expanded nav groups (e.g. "tasks"). */
  expanded: string[];
  /** Off-canvas navigation below the lg breakpoint (never persisted). */
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  toggleCollapsed: () => void;
  setCollapsed: (v: boolean) => void;
  toggleGroup: (key: string) => void;
  expandGroup: (key: string) => void;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      layout: 'classic',
      setLayout: (layout) => set({ layout }),
      collapsed: false,
      expanded: ['tasks'],
      mobileOpen: false,
      setMobileOpen: (mobileOpen) => set({ mobileOpen }),
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
    {
      name: 'lk-sidebar',
      partialize: (s) => ({ layout: s.layout, collapsed: s.collapsed, expanded: s.expanded }),
    },
  ),
);
