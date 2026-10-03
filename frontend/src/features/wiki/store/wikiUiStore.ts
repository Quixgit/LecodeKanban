import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const PANEL_MIN = 220;
export const PANEL_MAX = 480;
export const PANEL_DEFAULT = 288;

interface WikiUiState {
  /** Width of the tree panel in px. */
  panelWidth: number;
  panelCollapsed: boolean;
  /** Expanded node ids per user and space, so two people on one browser keep their own tree. */
  expanded: Record<string, Record<string, string[]>>;
  /** Last space opened per user. */
  lastSpace: Record<string, string>;
  setPanelWidth: (w: number) => void;
  setPanelCollapsed: (v: boolean) => void;
  setExpanded: (user: string, space: string, ids: string[]) => void;
  setLastSpace: (user: string, space: string) => void;
}

export const clampWidth = (w: number) => Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(w)));

export const useWikiUiStore = create<WikiUiState>()(
  persist(
    (set) => ({
      panelWidth: PANEL_DEFAULT,
      panelCollapsed: false,
      expanded: {},
      lastSpace: {},
      setPanelWidth: (w) => set({ panelWidth: clampWidth(w) }),
      setPanelCollapsed: (panelCollapsed) => set({ panelCollapsed }),
      setExpanded: (user, space, ids) =>
        set((s) => ({
          expanded: { ...s.expanded, [user]: { ...s.expanded[user], [space]: ids } },
        })),
      setLastSpace: (user, space) => set((s) => ({ lastSpace: { ...s.lastSpace, [user]: space } })),
    }),
    { name: 'lk-wiki' },
  ),
);
