import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Density = 'comfortable' | 'compact';

interface State {
  density: Density;
  setDensity: (d: Density) => void;
}

/** How much room the interface takes: row, control and header heights follow `html[data-density]`. */
export const useDensity = create<State>()(
  persist(
    (set) => ({
      density: 'comfortable',
      setDensity: (density) => set({ density }),
    }),
    { name: 'lk-density', partialize: (s) => ({ density: s.density }) },
  ),
);

function apply(d: Density) {
  if (typeof document !== 'undefined') document.documentElement.dataset.density = d;
}

// Set before the first paint, and kept in step afterwards.
apply(useDensity.getState().density);
useDensity.subscribe((s) => apply(s.density));
