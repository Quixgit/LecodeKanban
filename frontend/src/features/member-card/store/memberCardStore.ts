import { create } from 'zustand';

interface MemberCardState {
  userId: string | null;
  open: (userId: string) => void;
  close: () => void;
}

/** Which teammate's profile card is open. Any name or avatar in the app can open it. */
export const useMemberCardStore = create<MemberCardState>((set) => ({
  userId: null,
  open: (userId) => set({ userId }),
  close: () => set({ userId: null }),
}));
