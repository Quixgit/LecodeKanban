import { create } from 'zustand';

interface PaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (v: boolean) => void;
}

export const useCommandPalette = create<PaletteState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setOpen: (isOpen) => set({ isOpen }),
}));
