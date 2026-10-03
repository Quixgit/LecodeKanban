import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DrawerState {
  /** The task window fills the screen instead of sliding in as a side panel. */
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}

export const useCardDrawerStore = create<DrawerState>()(
  persist(
    (set) => ({
      expanded: false,
      setExpanded: (expanded) => set({ expanded }),
    }),
    { name: 'lk.card-drawer', version: 1 },
  ),
);
