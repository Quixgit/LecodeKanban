import type { ChatChannel } from '../api/chatApi';

/** The name shown for a channel: "#general" or the other people in a conversation. */
export function channelTitle(c: ChatChannel, me: string, you: string): string {
  if (c.name) return c.name;
  const others = c.people.filter((p) => p.id !== me).map((p) => p.name);
  if (others.length === 0) return `${c.people[0]?.name ?? ''} (${you})`.trim();
  return others.join(', ');
}

/** The unread count the person asked to see: everything, only mentions, or nothing when muted. */
export function visibleUnread(c: Pick<ChatChannel, 'notify' | 'unread' | 'mentions'>): number {
  if (c.notify === 'muted') return 0;
  return c.notify === 'mentions' ? c.mentions : c.unread;
}

export interface ChannelGroups {
  muted: ChatChannel[];
  starred: ChatChannel[];
  channels: ChatChannel[];
  direct: ChatChannel[];
  browsable: ChatChannel[];
}

/** Splits the channel list for the sidebar: starred, joined channels, conversations, and public channels to join. */
export function groupChannels(all: readonly ChatChannel[]): ChannelGroups {
  const byName = (a: ChatChannel, b: ChatChannel) => (a.name ?? '').localeCompare(b.name ?? '');
  const recent = (a: ChatChannel, b: ChatChannel) =>
    (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
  const mine = (c: ChatChannel) => c.kind === 'dm' || c.joined;
  const loud = (c: ChatChannel) => c.notify !== 'muted';
  return {
    muted: all.filter((c) => !loud(c) && mine(c)).sort(byName),
    starred: all
      .filter((c) => loud(c) && c.starred && mine(c))
      .sort((a, b) => Number(a.kind === 'dm') - Number(b.kind === 'dm') || byName(a, b)),
    channels: all.filter((c) => loud(c) && c.kind !== 'dm' && c.joined && !c.starred).sort(byName),
    direct: all.filter((c) => loud(c) && c.kind === 'dm' && !c.starred).sort(recent),
    browsable: all.filter((c) => c.kind === 'public').sort(byName),
  };
}

/** Same rule as the server: lower-case, spaces become dashes, no leading "#". */
export const normalizeChannelName = (s: string) =>
  s.trim().toLowerCase().replace(/^#/, '').split(/\s+/).filter(Boolean).join('-');
