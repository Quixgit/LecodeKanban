import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Remembers the element focused when `open` becomes true and returns a Radix
 * `onCloseAutoFocus` handler that restores focus to it. Radix only restores
 * focus to its own <Dialog.Trigger>; our dialogs are opened from arbitrary
 * buttons and shortcuts, so without this focus would drop to <body>.
 */
export function useRestoreFocus(open: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement)
      previous.current = document.activeElement;
  }, [open]);

  return useCallback((event: Event) => {
    event.preventDefault();
    const el = previous.current;
    previous.current = null;
    if (el?.isConnected) el.focus();
  }, []);
}
