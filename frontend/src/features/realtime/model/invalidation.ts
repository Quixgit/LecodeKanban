import type { components } from '@/shared/api';

export type RealtimeMessage = components['schemas']['RealtimeMessage'];
export type QueryKeyPrefix = readonly unknown[];

/**
 * Maps a change hint to the query-key prefixes that must refetch. Hints carry ids only;
 * fresh data always comes from the authorised REST API.
 */
export function keysFor(m: RealtimeMessage): QueryKeyPrefix[] {
  const ws = m.workspaceId;
  const card = m.cardId ? [['card', m.cardId] as const] : [];
  const [topic] = m.type.split('.');
  switch (topic) {
    case 'card':
      return [['cards', ws], ['projects', ws], ...card];
    case 'checklist':
      // Progress and badge counts on boards/lists change with the card's details.
      return [['cards', ws], ['projects', ws], ...card];
    case 'comment':
    case 'attachment':
      return [['cards', ws], ...card];
    case 'labels':
      return [
        ['labels', ws],
        ['cards', ws],
      ];
    case 'chat':
      return [
        ['chat', 'channels', ws],
        ...(m.channelId ? [['chat', 'messages', m.channelId] as const] : []),
        ['chat', 'thread'],
        ['chat', 'scope'],
        ...(m.channelId ? [['chat', 'members', m.channelId] as const] : []),
      ];
    case 'columns':
      return [['boardColumns'], ['cards', ws]];
    default:
      return [['cards', ws]];
  }
}

/** Everything a client may have missed (listener reconnect or dropped messages). */
export function resyncKeys(ws: string): QueryKeyPrefix[] {
  return [['cards', ws], ['projects', ws], ['labels', ws], ['boardColumns'], ['card'], ['chat']];
}

/** De-duplicates prefixes (by JSON) so a burst of hints triggers one refetch each. */
export function mergeKeys(into: Map<string, QueryKeyPrefix>, keys: QueryKeyPrefix[]) {
  for (const k of keys) into.set(JSON.stringify(k), k);
}
