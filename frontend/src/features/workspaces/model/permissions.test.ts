import { describe, expect, it } from 'vitest';
import { assignableRoles, canAssign, canRemove, invitableRoles } from './permissions';

// Same table as backend workspaces/domain/rbac_test.go: client and server must agree.
describe('RBAC mirror', () => {
  it.each([
    ['owner', 'member', 'owner', false, true],
    ['admin', 'member', 'admin', false, true],
    ['admin', 'member', 'owner', false, false],
    ['admin', 'admin', 'member', false, false],
    ['admin', 'owner', 'viewer', false, false],
    ['admin', 'admin', 'member', true, true],
    ['member', 'member', 'admin', true, false],
    ['member', 'viewer', 'member', false, false],
  ] as const)('canAssign(%s, %s → %s, self=%s) = %s', (actor, target, to, self, want) => {
    expect(canAssign(actor, target, to, self)).toBe(want);
  });

  it('canRemove', () => {
    expect(canRemove('member', 'member', true)).toBe(true);
    expect(canRemove('viewer', 'owner', false)).toBe(false);
    expect(canRemove('admin', 'viewer', false)).toBe(true);
    expect(canRemove('admin', 'admin', false)).toBe(false);
  });

  it('lists roles offered in the UI', () => {
    expect(assignableRoles('admin', 'member', false)).toEqual(['admin', 'member', 'viewer']);
    expect(assignableRoles('member', 'member', true)).toEqual(['member', 'viewer']);
    expect(invitableRoles('admin')).toEqual(['admin', 'member', 'viewer']);
    expect(invitableRoles('member')).toEqual(['member', 'viewer']);
  });
});
