import { useEffect } from 'react';
import { create } from 'zustand';
import { onRealtime } from '@/features/realtime';

const TTL_MS = 5000;

interface TypingState {
  /** channel → user → expiry (ms since epoch). */
  typing: Record<string, Record<string, number>>;
  mark: (channel: string, user: string) => void;
  prune: () => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  typing: {},
  mark: (channel, user) =>
    set((s) => ({
      typing: { ...s.typing, [channel]: { ...s.typing[channel], [user]: Date.now() + TTL_MS } },
    })),
  prune: () =>
    set((s) => {
      const now = Date.now();
      const next: TypingState['typing'] = {};
      for (const [c, users] of Object.entries(s.typing)) {
        const live = Object.fromEntries(Object.entries(users).filter(([, t]) => t > now));
        if (Object.keys(live).length) next[c] = live;
      }
      return { typing: next };
    }),
}));

/** Feeds the typing store from live hints and expires entries; mount it where a chat is on screen. */
export function useTypingListener(me: string) {
  useEffect(() => {
    const off = onRealtime((m) => {
      if (m.type === 'chat.typing' && m.channelId && m.actorId && m.actorId !== me) {
        useTypingStore.getState().mark(m.channelId, m.actorId);
      }
    });
    const id = window.setInterval(() => useTypingStore.getState().prune(), 1000);
    return () => {
      off();
      window.clearInterval(id);
    };
  }, [me]);
}
