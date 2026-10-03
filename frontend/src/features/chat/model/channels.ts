import type { ChatChannel } from '../api/chatApi';

/** The name shown for a channel: "#general" or the other people in a conversation. */
export function channelTitle(c: ChatChannel, me: string, you: string): string {
  if (c.name) return c.name;
  const others = c.people.filter((p) => p.id !== me).map((p) => p.name);
  if (others.length === 0) return `${c.people[0]?.name ?? ''} (${you})`.trim();
  return others.join(', ');
}

export interface ChannelGroups {
  channels: ChatChannel[];
  direct: ChatChannel[];
  browsable: ChatChannel[];
}

/** Splits the channel list for the sidebar: joined channels, conversations, and public channels to join. */
export function groupChannels(all: readonly ChatChannel[]): ChannelGroups {
  const byName = (a: ChatChannel, b: ChatChannel) => (a.name ?? '').localeCompare(b.name ?? '');
  const recent = (a: ChatChannel, b: ChatChannel) =>
    (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');
  return {
    channels: all.filter((c) => c.kind !== 'dm' && c.joined).sort(byName),
    direct: all.filter((c) => c.kind === 'dm').sort(recent),
    browsable: all.filter((c) => c.kind === 'public').sort(byName),
  };
}

/** Same rule as the server: lower-case, spaces become dashes, no leading "#". */
export const normalizeChannelName = (s: string) =>
  s.trim().toLowerCase().replace(/^#/, '').split(/\s+/).filter(Boolean).join('-');
