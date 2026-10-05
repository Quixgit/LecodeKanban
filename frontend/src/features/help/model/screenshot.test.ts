import { describe, expect, it } from 'vitest';
import { checkScreenshot, MAX_SCREENSHOT_BYTES, toBase64 } from './screenshot';

describe('screenshot checks', () => {
  it('accepts the three image types within 2 MB', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp'])
      expect(checkScreenshot({ type, size: 1000 })).toBeNull();
  });
  it('refuses other types and big files', () => {
    expect(checkScreenshot({ type: 'image/gif', size: 10 })).toBe('type');
    expect(checkScreenshot({ type: 'text/html', size: 10 })).toBe('type');
    expect(checkScreenshot({ type: 'image/png', size: MAX_SCREENSHOT_BYTES + 1 })).toBe('size');
  });
  it('encodes a file as bare base64', async () => {
    expect(await toBase64(new Blob(['hello'], { type: 'text/plain' }))).toBe('aGVsbG8=');
  });
});
