import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_THEME, isHex, type ChatTheme } from '../model/theme';

interface State extends ChatTheme {
  set: (t: Partial<ChatTheme>) => void;
  reset: () => void;
}

/** The chat look is a per-browser preference. */
export const useChatThemeStore = create<State>()(
  persist(
    (set) => ({
      ...DEFAULT_THEME,
      set: (t) =>
        set((s) => ({
          sidebar: t.sidebar && isHex(t.sidebar) ? t.sidebar : s.sidebar,
          accent: t.accent && isHex(t.accent) ? t.accent : s.accent,
        })),
      reset: () => set({ ...DEFAULT_THEME }),
    }),
    {
      name: 'lk-chat-theme',
      partialize: (s) => ({ sidebar: s.sidebar, accent: s.accent }),
    },
  ),
);
