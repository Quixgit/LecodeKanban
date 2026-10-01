import { useEffect } from 'react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { resolveTheme, useThemeStore, type ResolvedTheme } from './themeStore';

/** Current resolved theme plus a toggle that flips between light and dark. */
export function useTheme() {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const resolved: ResolvedTheme = resolveTheme(preference, systemDark);

  return {
    preference,
    resolved,
    setPreference,
    toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
  };
}

/** Mount once at the root: mirrors the resolved theme onto <html data-theme>. */
export function useApplyTheme() {
  const { resolved } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    if (root.dataset.theme === resolved) return;
    // Briefly enable color transitions so the swap cross-fades instead of flashing.
    root.classList.add('theme-switching');
    root.dataset.theme = resolved;
    const id = window.setTimeout(() => root.classList.remove('theme-switching'), 260);
    return () => window.clearTimeout(id);
  }, [resolved]);
}
