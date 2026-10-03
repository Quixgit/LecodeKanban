import type { JSONContent } from '@tiptap/react';

/**
 * Client-side mirror of the server's allow-list for link and image targets. The server is the
 * authority (it refuses anything else); this keeps a paste from foreign HTML from making a whole
 * autosave fail: unsafe links lose their link mark, unsafe images disappear.
 */
const FILE_PATH = /^\/api\/v1\/wiki\/files\/[0-9a-f-]{36}\/content(\?inline=true)?$/;

export function isSafeLink(href: string): boolean {
  const h = href.trim();
  if (h === '') return true;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(h)) return false;
  if (h.startsWith('/') && !h.startsWith('//')) return true;
  if (h.startsWith('#')) return true;
  try {
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(new URL(h).protocol);
  } catch {
    return false;
  }
}

export function isSafeImage(src: string): boolean {
  if (FILE_PATH.test(src)) return true;
  try {
    return new URL(src).protocol === 'https:';
  } catch {
    return false;
  }
}

const YOUTUBE_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

export function isSafeVideo(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === 'https:' && YOUTUBE_HOSTS.has(u.host);
  } catch {
    return false;
  }
}

/** Returns a copy of the document with unsafe links, images and videos removed. */
export function sanitizeDoc(node: JSONContent): JSONContent {
  const out: JSONContent = { ...node };
  if (node.marks) {
    out.marks = node.marks.filter(
      (m) =>
        m.type !== 'link' ||
        isSafeLink(String((m.attrs as { href?: string } | undefined)?.href ?? '')),
    );
    if (out.marks.length === 0) delete out.marks;
  }
  if (node.content) {
    out.content = node.content
      .filter((c) => {
        const src = String((c.attrs as { src?: string } | undefined)?.src ?? '');
        if (c.type === 'image') return isSafeImage(src);
        if (c.type === 'youtube') return isSafeVideo(src);
        return true;
      })
      .map(sanitizeDoc);
  }
  return out;
}
