/** Link to a Help guide article, used by "Learn more in Help" on complex settings. */
export function helpPath(guide: string, article?: string): string {
  const q = new URLSearchParams({ guide });
  if (article) q.set('article', article);
  return `/help?${q.toString()}`;
}
