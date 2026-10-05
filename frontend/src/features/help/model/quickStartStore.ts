import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Steps the person ticks off by hand (the ones the platform cannot see for itself), kept per browser. */
interface State {
  marked: string[];
  toggle: (id: string) => void;
}

export const useQuickStartMarks = create<State>()(
  persist(
    (set) => ({
      marked: [],
      toggle: (id) =>
        set((s) => ({
          marked: s.marked.includes(id) ? s.marked.filter((m) => m !== id) : [...s.marked, id],
        })),
    }),
    { name: 'lk-quick-start' },
  ),
);
