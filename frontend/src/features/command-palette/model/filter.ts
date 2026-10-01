import type { Command } from './types';

/** Case/diacritic-insensitive match on label + keywords; all query words must match. */
export function filterCommands(commands: Command[], query: string): Command[] {
  const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '');
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands.filter((c) => {
    const hay = norm([c.label, c.group, ...(c.keywords ?? [])].join(' '));
    return words.every((w) => hay.includes(w));
  });
}
