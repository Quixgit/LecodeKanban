/** What the Help search looks through: guide articles, shortcuts and the platform's pages. */
export type HelpHitKind = 'guide' | 'shortcut' | 'page';

export interface HelpEntry {
  id: string;
  kind: HelpHitKind;
  title: string;
  /** One line shown under the title. */
  hint: string;
  /** Lower-cased text the query is matched against, besides the title. */
  body: string;
  /** Where choosing the result goes. */
  to: string;
}

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFKC');

/**
 * Every word of the query must appear somewhere in the entry; a hit in the title ranks above one in the body,
 * and a title that starts with the word ranks highest.
 */
export function searchHelp(entries: readonly HelpEntry[], query: string): HelpEntry[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const scored: { entry: HelpEntry; score: number }[] = [];
  for (const entry of entries) {
    const title = norm(entry.title);
    const body = norm(`${entry.hint} ${entry.body}`);
    let score = 0;
    let all = true;
    for (const w of words) {
      if (title.startsWith(w)) score += 6;
      else if (title.includes(w)) score += 4;
      else if (body.includes(w)) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ entry, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .map((s) => s.entry);
}
