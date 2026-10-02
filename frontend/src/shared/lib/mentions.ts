/** Mention token written by the comment editor: @[Display Name](user-uuid). */
export const MENTION_RE = /@\[([^\]\n]{1,80})\]\(([0-9a-fA-F-]{36})\)/g;

export function mentionToken(name: string, id: string): string {
  return `@[${name.replace(/[\]\n]/g, ' ').slice(0, 80)}](${id})`;
}

/** The "@query" being typed right before the caret, if any. */
export function activeMention(
  text: string,
  caret: number,
): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([\p{L}\p{N}._-]{0,30})$/u.exec(before);
  if (!m) return null;
  return { query: m[2]!, start: caret - m[2]!.length - 1 };
}
