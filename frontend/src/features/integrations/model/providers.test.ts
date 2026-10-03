import { describe, expect, it } from 'vitest';
import { standing } from './providers';

const base = { configured: true, connected: true, enabled: true, status: 'connected' };

describe('standing', () => {
  it('walks from setup to active', () => {
    expect(standing({ ...base, configured: false, connected: false })).toBe('needsSetup');
    expect(standing({ ...base, connected: false })).toBe('off');
    expect(standing(base)).toBe('active');
    expect(standing({ ...base, enabled: false })).toBe('paused');
    expect(standing({ ...base, status: 'error' })).toBe('reconnect');
  });
});
