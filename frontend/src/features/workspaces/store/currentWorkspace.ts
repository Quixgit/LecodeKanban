import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CurrentWorkspaceState {
  id: string | null;
  setId: (id: string | null) => void;
}

export const useCurrentWorkspaceStore = create<CurrentWorkspaceState>()(
  persist((set) => ({ id: null, setId: (id) => set({ id }) }), { name: 'lk-workspace' }),
);
