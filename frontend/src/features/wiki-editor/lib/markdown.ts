/**
 * Whether pasted plain text is Markdown worth converting: it needs a structural signal (heading,
 * list, quote, fence, table, link or emphasis). Ordinary sentences paste as they are.
 */
const SIGNALS: RegExp[] = [
  /^#{1,6}\s+\S/m, // heading
  /^\s*[-*+]\s+\S/m, // bullet
  /^\s*\d+[.)]\s+\S/m, // ordered
  /^\s*- \[[ xX]\]\s/m, // task
  /^>\s?\S/m, // quote
  /^```/m, // fence
  /^\s*\|.+\|\s*$\n^\s*\|?\s*:?-{3,}/m, // table
  /\[[^\]]+\]\((https?:\/\/|\/)[^)]+\)/, // link
  /(\*\*|__)\S.*?\S(\*\*|__)/, // bold
  /^---+\s*$/m, // rule
];

export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || (!t.includes('\n') && !/\*\*|\[.+\]\(|^#{1,6}\s|^```/.test(t))) return false;
  return SIGNALS.some((re) => re.test(t));
}

/** A safe file name for a downloaded page. */
export function fileNameFor(title: string, ext: string): string {
  const base = Array.from(title.trim(), (c) => (c.charCodeAt(0) < 32 ? ' ' : c))
    .join('')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();
  return `${base || 'page'}.${ext}`;
}

export function downloadText(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
