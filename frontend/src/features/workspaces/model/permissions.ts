import type { InviteRole, Role } from '@/shared/api';

/**
 * Client mirror of the server RBAC policy (backend workspaces/domain/rbac.go),
 * used only to hide controls; the server remains the authority.
 */
const rank: Record<Role, number> = { owner: 4, admin: 3, member: 2, viewer: 1 };

export const ROLES: Role[] = ['owner', 'admin', 'member', 'viewer'];
export const INVITE_ROLES: InviteRole[] = ['admin', 'member', 'viewer'];

export const canManageMembers = (actor: Role) => rank[actor] >= rank.admin;

export function canAssign(actor: Role, target: Role, to: Role, self: boolean): boolean {
  if (self && rank[to] <= rank[target]) return true;
  if (actor === 'owner') return true;
  return actor === 'admin' && rank[target] < rank.admin && rank[to] <= rank.admin;
}

export function canRemove(actor: Role, target: Role, self: boolean): boolean {
  if (self || actor === 'owner') return true;
  return actor === 'admin' && rank[target] < rank.admin;
}

export function assignableRoles(actor: Role, target: Role, self: boolean): Role[] {
  return ROLES.filter((r) => r === target || canAssign(actor, target, r, self));
}

export function invitableRoles(actor: Role): InviteRole[] {
  // The server also needs the invite permission; the dialog is only opened by people who have it.
  return INVITE_ROLES.filter((r) => rank[r] <= rank[actor]);
}
