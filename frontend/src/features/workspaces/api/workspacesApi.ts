import { api, unwrap, type InviteRole, type Role } from '@/shared/api';

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const workspacesApi = {
  list: () => unwrap(api.GET('/workspaces')),
  create: (name: string) => unwrap(api.POST('/workspaces', { body: { name } })),
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
  previewInvite: (token: string) =>
    unwrap(api.GET('/invites/{token}', { params: { path: { token } } })),
  acceptInvite: (token: string) =>
    unwrap(api.POST('/invites/{token}/accept', { params: { path: { token } } })),
};
