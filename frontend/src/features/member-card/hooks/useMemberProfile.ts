import { useQuery } from '@tanstack/react-query';
import { memberApi } from '../api/memberApi';

export function useMemberProfile(workspaceId: string | undefined, userId: string | null) {
  return useQuery({
    queryKey: ['member-profile', workspaceId, userId],
    queryFn: () => memberApi.profile(workspaceId!, userId!),
    enabled: !!workspaceId && !!userId,
    staleTime: 30_000,
  });
}
