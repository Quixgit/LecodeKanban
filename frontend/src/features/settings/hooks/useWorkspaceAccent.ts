import { useEffect } from 'react';
import { accentCss } from '@/shared/lib/color';
import { useWorkspaceSettings } from './useSettings';

const ID = 'lk-workspace-accent';

/** Paints the app in the workspace's accent colour (buttons, highlights, links) for every member. */
export function useWorkspaceAccent(workspaceId: string | undefined) {
  const accent = useWorkspaceSettings(workspaceId).data?.accentColor ?? '';
  useEffect(() => {
    const css = accentCss(accent);
    let el = document.getElementById(ID) as HTMLStyleElement | null;
    if (!css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement('style');
      el.id = ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => el?.remove();
  }, [accent]);
}
