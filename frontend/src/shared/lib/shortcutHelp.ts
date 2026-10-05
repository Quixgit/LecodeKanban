import { useEffect } from 'react';
import { create } from 'zustand';

export interface ShortcutItem {
  /** Keys pressed together, or one after another when `then` is set (g then t). */
  keys: readonly string[];
  then?: boolean;
  label: string;
}

export interface ShortcutSection {
  title: string;
  items: ShortcutItem[];
}

interface State {
  open: boolean;
  setOpen: (v: boolean) => void;
  sections: Record<string, ShortcutSection>;
  setSection: (id: string, s: ShortcutSection | null) => void;
}

/** The "?" help: every page tells it what its shortcuts are, and the dialog shows them next to the global ones. */
export const useShortcutHelp = create<State>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  sections: {},
  setSection: (id, s) =>
    set((st) => {
      const rest = Object.fromEntries(Object.entries(st.sections).filter(([k]) => k !== id));
      return { sections: s ? { ...rest, [id]: s } : rest };
    }),
}));

/** Lists a page's shortcuts in the help while the page is on screen. */
export function useShortcutSection(id: string, section: ShortcutSection) {
  const setSection = useShortcutHelp((s) => s.setSection);
  const key = JSON.stringify(section);
  useEffect(() => {
    setSection(id, JSON.parse(key) as ShortcutSection);
    return () => setSection(id, null);
  }, [id, key, setSection]);
}
