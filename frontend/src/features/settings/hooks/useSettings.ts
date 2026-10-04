import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@/features/workspaces';
import {
  settingsApi,
  type WorkspaceFeatures,
  type WorkspaceSettings,
  type WorkspaceSettingsPatch,
} from '../api/settingsApi';

export const settingsKeys = {
  one: (ws: string) => ['workspace-settings', ws] as const,
  audit: (ws: string) => ['workspace-audit', ws] as const,
};

export function useWorkspaceSettings(workspaceId: string | undefined) {
  return useQuery({
    queryKey: settingsKeys.one(workspaceId ?? ''),
    queryFn: () => settingsApi.get(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

/** Saves a change at once; the screen shows the new value straight away and rolls back on an error. */
export function useUpdateSettings(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: WorkspaceSettingsPatch) => settingsApi.update(workspaceId, patch),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: settingsKeys.one(workspaceId) });
      const before = qc.getQueryData<WorkspaceSettings>(settingsKeys.one(workspaceId));
      if (before)
        qc.setQueryData<WorkspaceSettings>(settingsKeys.one(workspaceId), {
          ...before,
          ...(patch as Partial<WorkspaceSettings>),
          features: { ...before.features, ...(patch.features ?? {}) },
        });
      return { before };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.before) qc.setQueryData(settingsKeys.one(workspaceId), ctx.before);
    },
    onSuccess: (s) => {
      qc.setQueryData(settingsKeys.one(workspaceId), s);
      void qc.invalidateQueries({ queryKey: settingsKeys.audit(workspaceId) });
    },
  });
}

export function useAudit(workspaceId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: settingsKeys.audit(workspaceId ?? ''),
    queryFn: () => settingsApi.audit(workspaceId!),
    enabled: !!workspaceId && enabled,
  });
}

export type FeatureKey = keyof WorkspaceFeatures;

/** Whether a part of the platform is switched on for the current workspace (on while loading). */
export function useFeatureEnabled(feature: FeatureKey): boolean {
  const { workspace } = useCurrentWorkspace();
  const { data } = useWorkspaceSettings(workspace?.id);
  return data ? data.features[feature] : true;
}
