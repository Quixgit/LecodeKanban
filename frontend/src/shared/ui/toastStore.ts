import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'error';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  durationMs: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (
    t: Omit<ToastItem, 'id' | 'tone' | 'durationMs'> &
      Partial<Pick<ToastItem, 'tone' | 'durationMs'>>,
  ) => number;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    const item: ToastItem = { tone: 'info', durationMs: 4500, ...t, id };
    set((s) => ({ toasts: [...s.toasts, item].slice(-5) }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

/** Imperative API usable from anywhere (mutations, event handlers). */
export const toast = {
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description }),
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToastStore.getState().push({ title, description, tone: 'error', durationMs: 7000 }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};
