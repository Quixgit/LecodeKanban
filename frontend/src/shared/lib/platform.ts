export const isMac =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Label for the primary modifier key: ⌘ on Apple platforms, Ctrl elsewhere. */
export const modKeyLabel = isMac ? '⌘' : 'Ctrl';
