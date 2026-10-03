import { describe, expect, it } from 'vitest';
import { FEED_KINDS, toggleKind } from './feed';

describe('toggleKind', () => {
  it('adds and removes kinds in display order', () => {
    expect(toggleKind(['moved'], 'created')).toEqual(['created', 'moved']);
    expect(toggleKind(['created', 'moved'], 'created')).toEqual(['moved']);
    expect(toggleKind([...FEED_KINDS], 'deleted')).not.toContain('deleted');
  });

  it('never turns the last kind off', () => {
    expect(toggleKind(['assigned'], 'assigned')).toEqual(['assigned']);
  });
});
