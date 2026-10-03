import type { JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/shared/api';

export type SaveState = 'saved' | 'saving' | 'offline' | 'conflict' | 'error';

const DEBOUNCE_MS = 900;
const MAX_WAIT_MS = 6000;
const RETRY_MS = 5000;

interface Options {
  /** Version the document was loaded at; each successful save advances it. */
  version: number;
  save: (doc: JSONContent, version: number) => Promise<{ version: number }>;
}

const isOffline = (e: unknown) =>
  !navigator.onLine || (isApiError(e) && (e.code === 'common.network' || e.status >= 500));

/**
 * Debounced, single-flight autosave. Changes made while a save is running are sent right after it;
 * a network failure keeps the text and retries (also when the browser comes back online); a
 * version conflict stops saving and is reported so the person can reload the other version.
 */
export function useAutosave({ version, save }: Options) {
  const [state, setState] = useState<SaveState>('saved');
  const [dirty, setDirty] = useState(false);
  const versionRef = useRef(version);
  const pending = useRef<JSONContent | null>(null);
  const firstDirty = useRef(0);
  const timer = useRef<number>();
  const inflight = useRef(false);
  const stopped = useRef(false); // conflict: no more writes until reset
  const saveRef = useRef(save);
  saveRef.current = save;

  const run = useCallback(async () => {
    if (inflight.current || stopped.current || !pending.current) return;
    const doc = pending.current;
    pending.current = null;
    inflight.current = true;
    setState('saving');
    try {
      const res = await saveRef.current(doc, versionRef.current);
      versionRef.current = res.version;
      inflight.current = false;
      if (pending.current) {
        void run();
      } else {
        firstDirty.current = 0;
        setDirty(false);
        setState('saved');
      }
    } catch (e) {
      inflight.current = false;
      pending.current ??= doc; // keep the text; a newer edit supersedes it
      if (isApiError(e) && e.code === 'wiki.content_conflict') {
        stopped.current = true;
        setState('conflict');
      } else if (isOffline(e)) {
        setState('offline');
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void run(), RETRY_MS);
      } else {
        setState('error');
      }
    }
  }, []);

  const queue = useCallback(
    (doc: JSONContent) => {
      pending.current = doc;
      setDirty(true);
      if (stopped.current) return;
      const now = Date.now();
      if (!firstDirty.current) firstDirty.current = now;
      window.clearTimeout(timer.current);
      const wait = Math.max(0, Math.min(DEBOUNCE_MS, firstDirty.current + MAX_WAIT_MS - now));
      timer.current = window.setTimeout(() => void run(), wait);
    },
    [run],
  );

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    return run();
  }, [run]);

  /** Start over from a freshly loaded document (after a conflict or a manual reload). */
  const reset = useCallback((nextVersion: number) => {
    window.clearTimeout(timer.current);
    versionRef.current = nextVersion;
    pending.current = null;
    stopped.current = false;
    firstDirty.current = 0;
    setDirty(false);
    setState('saved');
  }, []);

  useEffect(() => {
    const online = () => void run();
    const hide = () => document.visibilityState === 'hidden' && void flush();
    const leave = (e: BeforeUnloadEvent) => {
      if (pending.current || inflight.current) e.preventDefault();
    };
    window.addEventListener('online', online);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('beforeunload', leave);
      void flush(); // leaving the page: send what is left
      window.clearTimeout(timer.current);
    };
  }, [run, flush]);

  return { state: dirty && state === 'saved' ? ('saving' as const) : state, queue, flush, reset };
}
