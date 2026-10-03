import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useSession } from '@/features/auth';
import { useCurrentWorkspace } from '@/features/workspaces';
import { integrationsApi, type IntegrationPatch, type Provider } from '../api/integrationsApi';

/** The realtime layer refreshes everything under ['integrations', ws, user] on a hint for the person. */
export const integrationKeys = {
  base: (ws: string, user: string) => ['integrations', ws, user] as const,
  list: (ws: string, user: string) => ['integrations', ws, user, 'list'] as const,
  meetings: (ws: string, user: string) => ['integrations', ws, user, 'meetings'] as const,
};

function useScope() {
  const { workspace } = useCurrentWorkspace();
  const { user } = useSession();
  return { ws: workspace?.id ?? '', me: user?.id ?? '' };
}

export function useIntegrations() {
  const { ws, me } = useScope();
  return useQuery({
    queryKey: integrationKeys.list(ws, me),
    enabled: !!ws && !!me,
    queryFn: () => integrationsApi.list(ws),
  });
}

/** The caller's next meetings; the minute-by-minute countdown re-renders from a cheap refetch. */
export function useMeetings() {
  const { ws, me } = useScope();
  return useQuery({
    queryKey: integrationKeys.meetings(ws, me),
    enabled: !!ws && !!me,
    queryFn: () => integrationsApi.meetings(ws),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}

export function useIntegrationMutations() {
  const { ws, me } = useScope();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: integrationKeys.base(ws, me) });
  return {
    connect: useMutation({ mutationFn: (p: Provider) => integrationsApi.connect(ws, p) }),
    update: useMutation({
      mutationFn: (v: { provider: Provider; patch: IntegrationPatch }) =>
        integrationsApi.update(ws, v.provider, v.patch),
      onSuccess: refresh,
    }),
    disconnect: useMutation({
      mutationFn: (p: Provider) => integrationsApi.disconnect(ws, p),
      onSuccess: refresh,
    }),
    sync: useMutation({
      mutationFn: (p: Provider) => integrationsApi.sync(ws, p),
      onSuccess: refresh,
    }),
  };
}

/** The current time, refreshed every `ms` so countdowns move without refetching anything. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}
