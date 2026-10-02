import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cardsApi, type LabelInput, type LabelPatch } from '../api/cardsApi';
import { cardKeys } from './useCards';

export const labelKeys = { all: (ws: string) => ['labels', ws] as const };

export function useLabels(workspaceId: string | undefined) {
  return useQuery({
    queryKey: labelKeys.all(workspaceId ?? ''),
    queryFn: () => cardsApi.labels(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useLabelMutations(workspaceId: string) {
  const qc = useQueryClient();
  // Label names/colours are rendered on cards, so card caches refresh too.
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: labelKeys.all(workspaceId) }),
      qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: LabelInput) => cardsApi.createLabel(workspaceId, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: LabelPatch }) => cardsApi.updateLabel(v.id, v.patch),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => cardsApi.deleteLabel(id),
      onSuccess: refresh,
    }),
  };
}
