import type { ChatChannel } from '../api/chatApi';
import { channelTitle } from './channels';

export type DateRange = 'day' | 'week' | 'month';

export interface SearchFilters {
  channel?: { id: string; title: string };
  from?: { id: string; name: string };
  mentionsMe?: boolean;
  hasLink?: boolean;
  hasFile?: boolean;
  threads?: boolean;
  range?: DateRange;
}

export interface Person {
  id: string;
  name: string;
}

export interface ParsedQuery {
  /** The free text left after the complete modifiers were removed. */
  text: string;
  filters: SearchFilters;
  /** A half-typed modifier at the end ("in:de", "from:an") to offer suggestions for. */
  partial?: { kind: 'in' | 'from'; term: string };
}

const norm = (s: string) => s.toLowerCase().replace(/^[#@]/, '');

/**
 * Reads Slack-style modifiers out of the search box: `in:#dev`, `from:@anna`, `from:me`, `has:link`,
 * `has:file`, `is:thread`, `with:me`, `before:`/`after:` are left to the chips. A modifier is applied
 * once it is complete (followed by a space) and names a known channel or person.
 */
export function parseQuery(
  input: string,
  channels: readonly ChatChannel[],
  people: readonly Person[],
  me: string,
  you: string,
): ParsedQuery {
  const filters: SearchFilters = {};
  const rest: string[] = [];
  const parts = input.split(/(\s+)/);
  let partial: ParsedQuery['partial'];
  const trailing = /\s$/.test(input);
  const tokens = parts.filter((p) => p.trim() !== '');
  tokens.forEach((tok, i) => {
    const last = i === tokens.length - 1 && !trailing;
    const m = /^(in|from|has|is|with):(.*)$/i.exec(tok);
    if (!m) return void rest.push(tok);
    const key = m[1]!.toLowerCase();
    const val = norm(m[2] ?? '');
    if (key === 'has' && (val === 'link' || val === 'file')) {
      if (last) return void rest.push(tok);
      if (val === 'link') filters.hasLink = true;
      else filters.hasFile = true;
      return;
    }
    if (key === 'is' && val === 'thread')
      return void (last ? rest.push(tok) : (filters.threads = true));
    if (key === 'with' && val === 'me')
      return void (last ? rest.push(tok) : (filters.mentionsMe = true));
    if (key === 'in') {
      const hit = channels.find((c) => norm(channelTitle(c, me, you)) === val);
      if (hit && !last)
        return void (filters.channel = { id: hit.id, title: channelTitle(hit, me, you) });
      if (last) return void (partial = { kind: 'in', term: val });
    }
    if (key === 'from') {
      if (val === 'me' && !last) return void (filters.from = { id: me, name: you });
      const hit = people.find((p) => norm(p.name).replace(/\s+/g, '') === val.replace(/\s+/g, ''));
      if (hit && !last) return void (filters.from = { id: hit.id, name: hit.name });
      if (last) return void (partial = { kind: 'from', term: val });
    }
    rest.push(tok);
  });
  return { text: rest.join(' '), filters, partial };
}

/** Channels and people that start with, or contain, what was typed after "in:" / "from:". */
export function suggest(
  partial: NonNullable<ParsedQuery['partial']>,
  channels: readonly ChatChannel[],
  people: readonly Person[],
  me: string,
  you: string,
): { id: string; label: string; kind: 'in' | 'from' }[] {
  const t = partial.term;
  const rank = (label: string) => {
    const n = norm(label);
    return n.startsWith(t) ? 0 : n.includes(t) ? 1 : 2;
  };
  if (partial.kind === 'in') {
    return channels
      .filter((c) => c.joined || c.kind === 'public')
      .map((c) => ({ id: c.id, label: channelTitle(c, me, you), kind: 'in' as const }))
      .filter((x) => rank(x.label) < 2)
      .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label))
      .slice(0, 6);
  }
  return people
    .map((p) => ({ id: p.id, label: p.name, kind: 'from' as const }))
    .filter((x) => rank(x.label) < 2)
    .sort((a, b) => rank(a.label) - rank(b.label) || a.label.localeCompare(b.label))
    .slice(0, 6);
}

export function hasAnyFilter(f: SearchFilters): boolean {
  return !!(f.channel || f.from || f.mentionsMe || f.hasLink || f.hasFile || f.threads || f.range);
}

/** The "after" timestamp of a date-range chip. */
export function rangeStart(range: DateRange, now = new Date()): string {
  const d = new Date(now);
  if (range === 'day') d.setHours(0, 0, 0, 0);
  else d.setTime(d.getTime() - (range === 'week' ? 7 : 30) * 86_400_000);
  return d.toISOString();
}
