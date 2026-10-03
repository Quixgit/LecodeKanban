import { apiBaseUrl } from './client';

export type ExportFormat = 'md' | 'html';

/** URL of a wiki export (one page, a folder with its subtree, or a whole space). It is a plain GET, so the browser downloads it. */
export function wikiExportUrl(
  target: { space: string } | { node: string; subtree?: boolean },
  format: ExportFormat,
): string {
  const base = apiBaseUrl.replace(/\/$/, '');
  if ('space' in target) return `${base}/wiki/spaces/${target.space}/export?format=${format}`;
  const subtree = target.subtree ? '&subtree=true' : '';
  return `${base}/wiki/nodes/${target.node}/export?format=${format}${subtree}`;
}

/** Starts a download without leaving the page. */
export function startDownload(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
