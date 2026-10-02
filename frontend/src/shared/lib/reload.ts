const KEY = 'lk-reloaded-at';
const WINDOW_MS = 15_000;

/**
 * Reloads the page to pick up a new deployment (a stale tab asks for chunks that no longer
 * exist). At most once per window, so a genuinely broken build cannot cause a reload loop.
 * Returns whether a reload was started.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: reload anyway rather than leave a dead page.
  }
  window.location.reload();
  return true;
}

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  return error instanceof Error && CHUNK_ERROR.test(error.message);
}
