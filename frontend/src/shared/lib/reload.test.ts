import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadOnce } from './reload';

describe('isChunkLoadError', () => {
  it('recognises stale-bundle failures only', () => {
    expect(
      isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /assets/x.js')),
    ).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('boom')).toBe(false);
  });
});

describe('reloadOnce', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
  });

  it('reloads once, then refuses inside the window (no reload loops)', () => {
    expect(reloadOnce()).toBe(true);
    expect(reloadOnce()).toBe(false);
    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});
