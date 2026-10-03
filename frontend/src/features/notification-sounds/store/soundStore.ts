import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SoundKind } from '../model/synth';

interface SoundState {
  enabled: boolean;
  /** 0–1 */
  volume: number;
  /** Which kinds are allowed; all on by default. */
  kinds: Record<SoundKind, boolean>;
  setEnabled: (v: boolean) => void;
  setVolume: (v: number) => void;
  setKind: (k: SoundKind, v: boolean) => void;
}

export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      enabled: true,
      volume: 0.6,
      kinds: { message: true, mention: true, task: true, notify: true },
      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setKind: (k, v) => set((s) => ({ kinds: { ...s.kinds, [k]: v } })),
    }),
    { name: 'lk.sounds', version: 1 },
  ),
);

export function soundAllowed(kind: SoundKind): boolean {
  const s = useSoundStore.getState();
  return s.enabled && s.kinds[kind];
}
