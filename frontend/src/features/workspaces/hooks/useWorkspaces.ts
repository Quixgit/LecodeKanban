import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InviteRole, Role, Workspace } from '@/shared/api';
import { workspacesApi } from '../api/workspacesApi';
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
