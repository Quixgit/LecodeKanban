import type { WikiRole } from './tree';

const RANK: Record<WikiRole, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 };

const atLeast = (role: WikiRole | null | undefined, min: WikiRole) =>
  !!role && RANK[role] >= RANK[min];

/** Capabilities of a wiki role; mirrors backend domain.Capability. */
export const can = {
  edit: (role: WikiRole | null | undefined) => atLeast(role, 'editor'),
  manage: (role: WikiRole | null | undefined) => atLeast(role, 'owner'),
};
