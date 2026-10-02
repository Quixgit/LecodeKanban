import { create } from 'zustand';

export type ConnectionState = 'connecting' | 'live' | 'offline';

interface RealtimeState {
  connection: ConnectionState;
  /** >0 while an interaction (e.g. a drag) must not be disturbed by refetches. */
  holds: number;
  setConnection: (c: ConnectionState) => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  connection: 'connecting',
  holds: 0,
  setConnection: (connection) => set({ connection }),
}));

/** Defers realtime refetches until the returned release function is called. */
export function holdRealtime(): () => void {
  useRealtimeStore.setState((s) => ({ holds: s.holds + 1 }));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    useRealtimeStore.setState((s) => ({ holds: Math.max(0, s.holds - 1) }));
  };
}
