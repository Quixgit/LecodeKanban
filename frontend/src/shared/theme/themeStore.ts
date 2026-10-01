import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

/** Persisted under `lk-theme`; index.html reads the same key to avoid a flash. */
export const useThemeStore = create<ThemeState>()(
  persist((set) => ({ preference: 'system', setPreference: (preference) => set({ preference }) }), {
    name: 'lk-theme',
  }),
);

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}
