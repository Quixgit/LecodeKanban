import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cardKeys } from '@/features/cards';
import {
  templatesApi,
  type RecurringTaskInput,
  type TaskTemplateInput,
  type UseTemplateRequest,
} from '../api/templatesApi';

export const templateKeys = {
  list: (ws: string) => ['templates', ws] as const,
  recurring: (ws: string) => ['recurring', ws] as const,
};

export function useTemplates(ws: string | undefined) {
  return useQuery({
    queryKey: templateKeys.list(ws ?? ''),
    queryFn: () => templatesApi.list(ws!),
    enabled: !!ws,
  });
}

export function useRecurring(ws: string | undefined) {
  return useQuery({
    queryKey: templateKeys.recurring(ws ?? ''),
    queryFn: () => templatesApi.recurring(ws!),
    enabled: !!ws,
  });
}

export function useTemplateMutations(ws: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: templateKeys.list(ws) }),
      // Deleting a template also removes the schedules that used it.
      qc.invalidateQueries({ queryKey: templateKeys.recurring(ws) }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: TaskTemplateInput) => templatesApi.create(ws, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; body: TaskTemplateInput }) => templatesApi.update(v.id, v.body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => templatesApi.remove(id),
      onSuccess: refresh,
    }),
    use: useMutation({
      mutationFn: (v: { id: string; body: UseTemplateRequest }) => templatesApi.use(v.id, v.body),
      onSuccess: () => qc.invalidateQueries({ queryKey: cardKeys.all(ws) }),
    }),
  };
}

export function useRecurringMutations(ws: string) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: templateKeys.recurring(ws) });
  return {
    create: useMutation({
      mutationFn: (body: RecurringTaskInput) => templatesApi.createRecurring(ws, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; body: RecurringTaskInput }) =>
        templatesApi.updateRecurring(v.id, v.body),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => templatesApi.removeRecurring(id),
      onSuccess: refresh,
    }),
  };
}
