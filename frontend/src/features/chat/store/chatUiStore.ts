import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_DRAFTS = 40;

interface ChatUiState {
  /** Sections collapsed in the channel list. */
  collapsed: { starred: boolean; channels: boolean; direct: boolean };
  /** Last open channel per user, to reopen where they left off. */
  lastChannel: Record<string, string>;
  /** Unsent text per channel or thread (keyed "c:<id>" / "t:<id>"). */
  drafts: Record<string, string>;
  toggleSection: (key: 'starred' | 'channels' | 'direct') => void;
  setLastChannel: (user: string, channel: string) => void;
  setDraft: (key: string, text: string) => void;
}

export const useChatUiStore = create<ChatUiState>()(
  persist(
    (set) => ({
      collapsed: { starred: false, channels: false, direct: false },
      lastChannel: {},
      drafts: {},
      toggleSection: (key) =>
        set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } })),
      setLastChannel: (user, channel) =>
        set((s) =>
          s.lastChannel[user] === channel
            ? s
            : { lastChannel: { ...s.lastChannel, [user]: channel } },
        ),
      setDraft: (key, text) =>
        set((s) => {
          // Re-insert so the newest draft is last, then keep only the most recent ones.
          const rest = Object.entries(s.drafts).filter(([k]) => k !== key);
          const next = text ? [...rest, [key, text] as const] : rest;
          return { drafts: Object.fromEntries(next.slice(-MAX_DRAFTS)) };
        }),
    }),
    {
      name: 'lk.chat.ui',
      version: 2,
      // v1 had no "starred" section.
      migrate: (state) => {
        const s = state as { collapsed?: Record<string, boolean> };
        return {
          ...s,
          collapsed: { starred: false, channels: false, direct: false, ...s.collapsed },
        } as never;
      },
    },
  ),
);
