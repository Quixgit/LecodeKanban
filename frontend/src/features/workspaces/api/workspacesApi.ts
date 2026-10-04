import { api, unwrap, type components, type InviteRole, type Role } from '@/shared/api';

export type RoleInput = components['schemas']['RoleInput'];
export type RoleDefinition = components['schemas']['RoleDefinition'];
export type RolesOverview = components['schemas']['RolesOverview'];
export type PermissionInfo = components['schemas']['PermissionInfo'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const workspacesApi = {
  list: () => unwrap(api.GET('/workspaces')),
  create: (name: string) => unwrap(api.POST('/workspaces', { body: { name } })),
  rename: (id: string, name: string) =>
    unwrap(api.PATCH('/workspaces/{workspaceId}', { ...ws(id), body: { name } })),
  delete: (id: string) => unwrap(api.DELETE('/workspaces/{workspaceId}', ws(id))),
  members: (id: string) => unwrap(api.GET('/workspaces/{workspaceId}/members', ws(id))),
  invites: (id: string) => unwrap(api.GET('/workspaces/{workspaceId}/invites', ws(id))),
  invite: (id: string, email: string, role: InviteRole) =>
    unwrap(api.POST('/workspaces/{workspaceId}/invites', { ...ws(id), body: { email, role } })),
  revokeInvite: (id: string, inviteId: string) =>
    unwrap(
      api.DELETE('/workspaces/{workspaceId}/invites/{inviteId}', {
        params: { path: { workspaceId: id, inviteId } },
      }),
    ),
  changeRole: (id: string, userId: string, role: Role) =>
    unwrap(
      api.PATCH('/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId: id, userId } },
        body: { role },
      }),
    ),
  removeMember: (id: string, userId: string) =>
    unwrap(
      api.DELETE('/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId: id, userId } },
      }),
    ),
  roles: (id: string) => unwrap(api.GET('/workspaces/{workspaceId}/roles', ws(id))),
  assignCustomRole: (id: string, userId: string, roleId: string | null) =>
    unwrap(
      api.PUT('/workspaces/{workspaceId}/members/{userId}/custom-role', {
        params: { path: { workspaceId: id, userId } },
        body: { roleId },
      }),
    ),
  createRole: (id: string, body: RoleInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/roles', { ...ws(id), body })),
  updateRole: (id: string, roleKey: string, body: RoleInput) =>
    unwrap(
      api.PATCH('/workspaces/{workspaceId}/roles/{roleKey}', {
        params: { path: { workspaceId: id, roleKey } },
        body,
      }),
    ),
  deleteRole: (id: string, roleKey: string) =>
    unwrap(
      api.DELETE('/workspaces/{workspaceId}/roles/{roleKey}', {
        params: { path: { workspaceId: id, roleKey } },
      }),
    ),
  setRolePermissions: (id: string, roleKey: string, permissions: string[]) =>
    unwrap(
      api.PUT('/workspaces/{workspaceId}/roles/{roleKey}', {
        params: { path: { workspaceId: id, roleKey } },
        body: { permissions },
      }),
    ),
  resetRole: (id: string, roleKey: string) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/roles/{roleKey}/reset', {
        params: { path: { workspaceId: id, roleKey } },
      }),
    ),
  previewInvite: (token: string) =>
    unwrap(api.GET('/invites/{token}', { params: { path: { token } } })),
  acceptInvite: (token: string) =>
    unwrap(api.POST('/invites/{token}/accept', { params: { path: { token } } })),
};
