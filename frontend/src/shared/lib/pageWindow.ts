/** Page numbers with ellipsis: 1 2 3 … 7 (current always visible). */
export function pageWindow(page: number, pageCount: number): (number | 'gap')[] {
  if (pageCount <= 6) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const set = new Set(
    [1, 2, 3, page - 1, page, page + 1, pageCount].filter((p) => p >= 1 && p <= pageCount),
  );
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('gap');
    out.push(p);
  });
  return out;
}
