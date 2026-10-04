import { describe, expect, it } from 'vitest';
import { checkPicture, squareCrop } from './avatar';

describe('squareCrop', () => {
  it('centres the square in landscape and portrait pictures', () => {
    expect(squareCrop(400, 200)).toEqual({ x: 100, y: 0, side: 200 });
    expect(squareCrop(200, 500)).toEqual({ x: 0, y: 150, side: 200 });
    expect(squareCrop(64, 64)).toEqual({ x: 0, y: 0, side: 64 });
  });
});

describe('checkPicture', () => {
  it('accepts common pictures and refuses everything else', () => {
    expect(checkPicture({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(checkPicture({ type: 'image/svg+xml', size: 1000 })).toBe('type');
    expect(checkPicture({ type: 'application/pdf', size: 1000 })).toBe('type');
    expect(checkPicture({ type: 'image/png', size: 50 * 1024 * 1024 })).toBe('size');
  });
});
