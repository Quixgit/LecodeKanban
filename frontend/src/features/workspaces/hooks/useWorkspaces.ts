import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteRole, Role, Workspace } from '@/shared/api';
import { workspacesApi, type RoleInput } from '../api/workspacesApi';
import { useCurrentWorkspaceStore } from '../store/currentWorkspace';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  members: (id: string) => ['workspaces', id, 'members'] as const,
  invites: (id: string) => ['workspaces', id, 'invites'] as const,
};

export function useWorkspaces(enabled = true) {
  return useQuery({ queryKey: workspaceKeys.all, queryFn: workspacesApi.list, enabled });
}

/** The selected workspace (persisted), falling back to the first one. */
export function useCurrentWorkspace(): { workspace: Workspace | null; isLoading: boolean } {
  const { data, isPending } = useWorkspaces();
  const id = useCurrentWorkspaceStore((s) => s.id);
  const workspace = data?.find((w) => w.id === id) ?? data?.[0] ?? null;
  return { workspace, isLoading: isPending };
}

export const roleKeys = { all: (id: string) => ['workspaces', id, 'roles'] as const };

/** The permission catalog and every role (built-in and custom) of the workspace. */
export function useRoles(workspaceId: string | undefined) {
  return useQuery({
    queryKey: roleKeys.all(workspaceId ?? ''),
    queryFn: () => workspacesApi.roles(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

/** Changes to roles: they also change what people may do, so the workspace list (permissions) refreshes too. */
export function useRoleMutations(workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: roleKeys.all(workspaceId) }),
      qc.invalidateQueries({ queryKey: workspaceKeys.all }),
      qc.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: RoleInput) => workspacesApi.createRole(workspaceId, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { key: string; body: RoleInput }) =>
        workspacesApi.updateRole(workspaceId, v.key, v.body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (key: string) => workspacesApi.deleteRole(workspaceId, key),
      onSuccess: refresh,
    }),
    setPermissions: useMutation({
      mutationFn: (v: { key: string; permissions: string[] }) =>
        workspacesApi.setRolePermissions(workspaceId, v.key, v.permissions),
      onSuccess: refresh,
    }),
    reset: useMutation({
      mutationFn: (key: string) => workspacesApi.resetRole(workspaceId, key),
      onSuccess: refresh,
    }),
    assign: useMutation({
      mutationFn: (v: { userId: string; roleId: string | null }) =>
        workspacesApi.assignCustomRole(workspaceId, v.userId, v.roleId),
      onSuccess: refresh,
    }),
  };
}

export function useMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? ''),
    queryFn: () => workspacesApi.members(workspaceId!),
    enabled: !!workspaceId,
  });
}

export function useInvites(workspaceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: workspaceKeys.invites(workspaceId ?? ''),
    queryFn: () => workspacesApi.invites(workspaceId!),
    enabled: !!workspaceId && enabled,
  });
}

export function useWorkspaceMutations(workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['workspaces'] });
  return {
    rename: useMutation({
      mutationFn: (name: string) => workspacesApi.rename(workspaceId, name),
      onSuccess: refresh,
    }),
    deleteWorkspace: useMutation({
      mutationFn: () => workspacesApi.delete(workspaceId),
      onSuccess: refresh,
    }),
    invite: useMutation({
      mutationFn: (v: { email: string; role: InviteRole }) =>
        workspacesApi.invite(workspaceId, v.email, v.role),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (inviteId: string) => workspacesApi.revokeInvite(workspaceId, inviteId),
      onSuccess: refresh,
    }),
    changeRole: useMutation({
      mutationFn: (v: { userId: string; role: Role }) =>
        workspacesApi.changeRole(workspaceId, v.userId, v.role),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
      onSuccess: refresh,
    }),
  };
}
