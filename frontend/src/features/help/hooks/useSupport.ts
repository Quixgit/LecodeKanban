import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supportApi, type SupportRequestInput, type SupportStatus } from '../api/supportApi';

export const supportKeys = {
  all: (ws: string) => ['support', ws] as const,
  list: (ws: string, scope: 'mine' | 'all') => ['support', ws, scope] as const,
};

/** Requests: `all` is what a support manager sees (the server narrows it to your own otherwise). */
export function useSupportList(
  workspaceId: string | undefined,
  scope: 'mine' | 'all',
  enabled = true,
) {
  return useQuery({
    queryKey: supportKeys.list(workspaceId ?? '', scope),
    queryFn: () => supportApi.list(workspaceId!, { mine: scope === 'mine' || undefined }),
    enabled: !!workspaceId && enabled,
  });
}

export function useSupportMutations(workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: supportKeys.all(workspaceId) });
  return {
    create: useMutation({
      mutationFn: (v: SupportRequestInput) => supportApi.create(workspaceId, v),
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: (v: { id: string; status: SupportStatus }) =>
        supportApi.setStatus(v.id, v.status),
      onSuccess: refresh,
    }),
  };
}

export function useBuildInfo() {
  return useQuery({ queryKey: ['meta'], queryFn: supportApi.buildInfo, staleTime: 5 * 60_000 });
}
