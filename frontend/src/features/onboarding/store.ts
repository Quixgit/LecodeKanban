import { create } from 'zustand';

/** Lets the empty-workspace screen (and a menu entry) bring the wizard back after it was skipped. */
interface State {
  forced: boolean;
  open: () => void;
  close: () => void;
}

export const useOnboardingStore = create<State>((set) => ({
  forced: false,
  open: () => set({ forced: true }),
  close: () => set({ forced: false }),
}));
