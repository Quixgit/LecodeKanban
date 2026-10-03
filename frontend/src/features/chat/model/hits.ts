import type { ChatHit } from '../api/chatApi';

/** Where a hit opens: its channel (or the thread it belongs to) with the message highlighted. */
export function hitUrl(h: ChatHit): string {
  const q = new URLSearchParams({ m: h.message.id });
  if (h.message.parentId) q.set('thread', h.message.parentId);
  return `/chat/${h.channel.id}?${q.toString()}`;
}
