import { useEffect, useRef } from 'react';

export interface HotkeyOptions {
  /** Require ⌘ (mac) / Ctrl (others). */
  mod?: boolean;
  shift?: boolean;
  /** Fire even when focus is inside an input/textarea/contenteditable. */
  allowInInputs?: boolean;
  enabled?: boolean;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Registers a global keyboard shortcut. `key` is compared case-insensitively. */
export function useHotkey(
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts: HotkeyOptions = {},
) {
  const { mod = false, shift = false, allowInInputs = false, enabled = true } = opts;
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      if (mod !== (e.metaKey || e.ctrlKey)) return;
      if (shift !== e.shiftKey) return;
      if (!allowInInputs && isTypingTarget(e.target)) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [key, mod, shift, allowInInputs, enabled]);
}
