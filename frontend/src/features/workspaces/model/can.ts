import type { Workspace } from '@/shared/api';

/** Every permission the platform knows; the server decides, the interface only hides what would be refused. */
export type PermissionKey =
  | 'workspace.view'
  | 'content.edit'
  | 'tasks.delete'
  | 'content.moderate'
  | 'projects.create'
  | 'projects.edit'
  | 'projects.delete'
  | 'boards.manage'
  | 'labels.manage'
  | 'fields.manage'
  | 'chat.channels.create'
  | 'chat.broadcast'
  | 'chat.moderate'
  | 'time.manage'
  | 'integrations.manage'
  | 'members.invite'
  | 'members.manage'
  | 'workspace.update'
  | 'audit.view'
  | 'data.export'
  | 'roles.manage'
  | 'workspace.delete';

/** Whether the person may do something in this workspace, from the permissions the server sent. */
export function can(
  workspace: Pick<Workspace, 'permissions'> | null | undefined,
  perm: PermissionKey,
): boolean {
  return !!workspace?.permissions.includes(perm);
}
