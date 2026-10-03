import type { RealtimeMessage } from './invalidation';

type Listener = (m: RealtimeMessage) => void;
const listeners = new Set<Listener>();

/** Lets a feature react to raw hints (typing indicators) that never touch the query cache. */
export function onRealtime(fn: Listener): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function emitRealtime(m: RealtimeMessage) {
  for (const fn of listeners) fn(m);
}
