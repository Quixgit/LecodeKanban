import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ShellLayout = 'classic' | 'rail';

interface State {
  /** classic: one column of labelled links. rail: icon strip, then the menu of the section you are in. */
  layout: ShellLayout;
  setLayout: (v: ShellLayout) => void;
  /** The empty column the rail offers a page for its own list (channels, the docs tree). */
  slot: HTMLElement | null;
  setSlot: (el: HTMLElement | null) => void;
}

export const useShellLayout = create<State>()(
  persist(
    (set) => ({
      layout: 'classic',
      setLayout: (layout) => set({ layout }),
      slot: null,
      setSlot: (slot) => set({ slot }),
    }),
    { name: 'lk-shell-layout', partialize: (s) => ({ layout: s.layout }) },
  ),
);

/**
 * For a page that has its own list (chat channels, the docs tree): in the rail layout on a wide screen the list
 * moves into the rail's column. `railed` says to leave the list out of the page; `target` is where to draw it
 * (null for a moment until the rail has mounted its column).
 */
export function useRailSlot(desktop: boolean): { railed: boolean; target: HTMLElement | null } {
  const layout = useShellLayout((s) => s.layout);
  const slot = useShellLayout((s) => s.slot);
  const railed = desktop && layout === 'rail';
  return { railed, target: railed ? slot : null };
}
