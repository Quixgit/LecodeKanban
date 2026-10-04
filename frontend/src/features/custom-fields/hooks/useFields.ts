import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fieldsApi,
  type CardFieldValue,
  type CustomField,
  type CustomFieldInput,
  type CustomFieldPatch,
  type FieldValue,
} from '../api/fieldsApi';

export const fieldKeys = {
  all: (ws: string) => ['custom-fields', ws] as const,
  card: (card: string) => ['custom-fields', 'card', card] as const,
  board: (ws: string) => ['custom-fields', 'board', ws] as const,
};

export function useCustomFields(workspaceId: string | undefined) {
  return useQuery({
    queryKey: fieldKeys.all(workspaceId ?? ''),
    queryFn: () => fieldsApi.list(workspaceId!),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
}

export function useFieldMutations(workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['custom-fields'] });
  return {
    create: useMutation({
      mutationFn: (body: CustomFieldInput) => fieldsApi.create(workspaceId, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: CustomFieldPatch }) => fieldsApi.update(v.id, v.patch),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: fieldsApi.remove, onSuccess: refresh }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => fieldsApi.reorder(workspaceId, ids),
      // Show the new order at once; the server answer only confirms it.
      onMutate: async (ids) => {
        qc.setQueryData<CustomField[]>(fieldKeys.all(workspaceId), (old) =>
          old ? ids.map((id) => old.find((f) => f.id === id)!).filter(Boolean) : old,
        );
      },
      onSettled: refresh,
    }),
  };
}

export function useCardFieldValues(cardId: string | undefined) {
  return useQuery({
    queryKey: fieldKeys.card(cardId ?? ''),
    queryFn: () => fieldsApi.cardValues(cardId!),
    enabled: !!cardId,
  });
}

export function useSetFieldValue(cardId: string, workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fieldId: string; value: FieldValue }) =>
      fieldsApi.setValue(cardId, v.fieldId, v.value),
    onSuccess: (_d, v) => {
      qc.setQueryData<CardFieldValue[]>(fieldKeys.card(cardId), (old = []) => {
        const rest = old.filter((x) => x.fieldId !== v.fieldId);
        return v.value === null || v.value === ''
          ? rest
          : [...rest, { cardId, fieldId: v.fieldId, value: v.value }];
      });
      void qc.invalidateQueries({ queryKey: fieldKeys.board(workspaceId) });
    },
  });
}

/** Values for the cards on the board, keyed "cardId:fieldId" → value. */
export function useBoardFieldValues(
  workspaceId: string | undefined,
  cardIds: readonly string[],
  enabled: boolean,
) {
  const ids = [...cardIds].sort().slice(0, 500);
  return useQuery({
    queryKey: [...fieldKeys.board(workspaceId ?? ''), ids],
    queryFn: () => fieldsApi.boardValues(workspaceId!, ids),
    enabled: !!workspaceId && enabled && ids.length > 0,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    select: (rows) => {
      const map = new Map<string, Map<string, unknown>>();
      for (const r of rows) {
        const m = map.get(r.cardId) ?? new Map<string, unknown>();
        m.set(r.fieldId, r.value);
        map.set(r.cardId, m);
      }
      return map;
    },
  });
}
