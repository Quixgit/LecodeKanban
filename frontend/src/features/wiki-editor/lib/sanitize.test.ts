import { describe, expect, it } from 'vitest';
import { isSafeImage, isSafeLink, isSafeVideo, sanitizeDoc } from './sanitize';

describe('link and image targets', () => {
  it.each([
    ['https://example.com/a?b=1', true],
    ['http://example.com', true],
    ['mailto:a@b.co', true],
    ['tel:+380441234567', true],
    ['/docs/p/abc', true],
    ['#section', true],
    ['javascript:alert(1)', false],
    ['  JaVaScRiPt:alert(1)', false],
    ['java\tscript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['//evil.example/x', false],
    ['vbscript:x', false],
  ])('link %j → %s', (href, ok) => expect(isSafeLink(href)).toBe(ok));

  it.each([
    ['https://cdn.example.com/a.png', true],
    ['/api/v1/wiki/files/0b6f4f0e-1c7e-4c3e-9b52-6d2b1a9e7f10/content?inline=true', true],
    ['http://insecure.example/a.png', false],
    ['data:image/png;base64,AAAA', false],
    ['/api/v1/auth/session', false],
    ['javascript:alert(1)', false],
  ])('image %j → %s', (src, ok) => expect(isSafeImage(src)).toBe(ok));

  it('only allows YouTube videos over https', () => {
    expect(isSafeVideo('https://www.youtube.com/embed/abc')).toBe(true);
    expect(isSafeVideo('https://youtu.be/abc')).toBe(true);
    expect(isSafeVideo('https://evil.example/x')).toBe(false);
    expect(isSafeVideo('http://www.youtube.com/embed/abc')).toBe(false);
  });
});

describe('sanitizeDoc', () => {
  it('drops unsafe links, images and videos but keeps the text', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'bad',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'bold' }],
            },
            {
              type: 'text',
              text: 'good',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
        { type: 'image', attrs: { src: 'http://insecure.example/a.png' } },
        { type: 'image', attrs: { src: 'https://cdn.example.com/a.png' } },
        { type: 'youtube', attrs: { src: 'https://evil.example/x' } },
      ],
    };
    const out = sanitizeDoc(doc);
    const para = out.content![0]!.content!;
    expect(para[0]!.marks).toEqual([{ type: 'bold' }]);
    expect(para[1]!.marks).toHaveLength(1);
    expect(out.content!.map((c) => c.type)).toEqual(['paragraph', 'image']);
    expect(JSON.stringify(out)).not.toContain('javascript:');
  });

  it('does not mutate its input', () => {
    const doc = { type: 'doc', content: [{ type: 'image', attrs: { src: 'http://x.y/a.png' } }] };
    sanitizeDoc(doc);
    expect(doc.content).toHaveLength(1);
  });
});
