import type { ChatChannel } from '../api/chatApi';

export type FeedKind = NonNullable<ChatChannel['feedEvents']>[number];

/** The task events a feed channel can take, in display order. */
export const FEED_KINDS: FeedKind[] = [
  'created',
  'assigned',
  'moved',
  'updated',
  'deleted',
  'commented',
];

/** Toggles one kind; at least one always stays on (a feed that takes nothing is pointless). */
export function toggleKind(current: readonly FeedKind[], kind: FeedKind): FeedKind[] {
  const on = current.includes(kind);
  if (on && current.length === 1) return [...current];
  return FEED_KINDS.filter((k) => (k === kind ? !on : current.includes(k)));
}
