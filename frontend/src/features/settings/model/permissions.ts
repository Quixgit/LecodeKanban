/** The key of a permission as used in translations (dots become underscores). */
export const permKey = (key: string) => key.replace(/\./g, '_');

export const PERM_GROUPS = [
  'general',
  'tasks',
  'projects',
  'chat',
  'time',
  'people',
  'admin',
] as const;

/** Starting points when creating a role: copy the permissions of a built-in role, or begin empty. */
export type RolePreset = 'blank' | 'viewer' | 'member' | 'admin';
