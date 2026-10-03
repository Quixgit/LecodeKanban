import type { SoundKind } from './synth';

export interface ChannelCounts {
  unread: number;
  mentions: number;
  muted: boolean;
  joined: boolean;
  /** A task feed: new items ring the task sound instead of the message sound. */
  feed?: boolean;
}

/**
 * Compares two snapshots of the channel list and decides whether something new arrived: a rise in
 * mentions rings the mention sound, a rise in unread messages the message sound. Muted channels and
 * the conversation the person is looking at stay quiet.
 */
export function detectChatSound(
  prev: ReadonlyMap<string, ChannelCounts>,
  next: ReadonlyMap<string, ChannelCounts>,
  watching: string | undefined,
): SoundKind | undefined {
  let sound: SoundKind | undefined;
  for (const [id, n] of next) {
    const p = prev.get(id);
    if (!p || !n.joined || n.muted || id === watching) continue;
    if (n.mentions > p.mentions) return 'mention';
    if (n.unread > p.unread) sound = n.feed ? (sound ?? 'task') : 'message';
  }
  return sound;
}
