import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { cardKeys } from '@/features/cards';
import { drawerApi, type ChecklistItem, type ChecklistItemPatch } from '../api/drawerApi';

export const drawerKeys = {
  checklist: (id: string) => [...cardKeys.one(id), 'checklist'] as const,
  comments: (id: string) => [...cardKeys.one(id), 'comments'] as const,
  attachments: (id: string) => [...cardKeys.one(id), 'attachments'] as const,
  activity: (id: string) => [...cardKeys.one(id), 'activity'] as const,
  columns: (projectId: string) => ['boardColumns', projectId] as const,
};

/** Refreshes the card, its activity and the board/list badges after a change. */
function useRefresh(cardId: string, workspaceId: string) {
  const qc = useQueryClient();
  return (...extra: QueryKey[]) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: cardKeys.one(cardId), exact: true }),
      qc.invalidateQueries({ queryKey: drawerKeys.activity(cardId) }),
      qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
      ...extra.map((queryKey) => qc.invalidateQueries({ queryKey })),
    ]);
}

export function useProjectColumns(projectId: string | undefined) {
  return useQuery({
    queryKey: drawerKeys.columns(projectId ?? ''),
    queryFn: () => drawerApi.columns(projectId!),
    enabled: !!projectId,
  });
}

export function useChecklist(cardId: string, workspaceId: string) {
  const qc = useQueryClient();
  const key = drawerKeys.checklist(cardId);
  const refresh = useRefresh(cardId, workspaceId);
  const list = useQuery({ queryKey: key, queryFn: () => drawerApi.checklist(cardId) });
  const add = useMutation({
    mutationFn: (text: string) => drawerApi.addItem(cardId, text),
    onSuccess: () => refresh(key, ['projects', workspaceId]),
  });
  const update = useMutation({
    mutationFn: (v: { id: string; patch: ChecklistItemPatch }) =>
      drawerApi.updateItem(v.id, v.patch),
    // Ticking, renaming and reordering must feel instant.
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChecklistItem[]>(key);
      if (previous) qc.setQueryData<ChecklistItem[]>(key, applyItemPatch(previous, id, patch));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(key, ctx.previous),
    onSettled: () => refresh(key, ['projects', workspaceId]),
  });
  const remove = useMutation({
    mutationFn: (id: string) => drawerApi.deleteItem(id),
    onSuccess: () => refresh(key, ['projects', workspaceId]),
  });
  return { list, add, update, remove };
}

export function useComments(cardId: string, workspaceId: string) {
  const key = drawerKeys.comments(cardId);
  const refresh = useRefresh(cardId, workspaceId);
  const list = useQuery({ queryKey: key, queryFn: () => drawerApi.comments(cardId) });
  const add = useMutation({
    mutationFn: (body: string) => drawerApi.addComment(cardId, body),
    onSuccess: () => refresh(key),
  });
  const edit = useMutation({
    mutationFn: (v: { id: string; body: string }) => drawerApi.editComment(v.id, v.body),
    onSuccess: () => refresh(key),
  });
  const remove = useMutation({
    mutationFn: (id: string) => drawerApi.deleteComment(id),
    onSuccess: () => refresh(key),
  });
  return { list, add, edit, remove };
}

export function useAttachments(cardId: string, workspaceId: string) {
  const key = drawerKeys.attachments(cardId);
  const refresh = useRefresh(cardId, workspaceId);
  const list = useQuery({ queryKey: key, queryFn: () => drawerApi.attachments(cardId) });
  const upload = useMutation({
    mutationFn: (file: File) => drawerApi.upload(cardId, file),
    onSuccess: () => refresh(key),
  });
  const remove = useMutation({
    mutationFn: (id: string) => drawerApi.deleteAttachment(id),
    onSuccess: () => refresh(key),
  });
  return { list, upload, remove };
}

export function useActivity(cardId: string) {
  return useInfiniteQuery({
    queryKey: drawerKeys.activity(cardId),
    queryFn: ({ pageParam }) => drawerApi.activity(cardId, pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
  });
}

/** Local equivalent of an item patch (done / text / move between neighbours). */
export function applyItemPatch(
  items: ChecklistItem[],
  id: string,
  patch: ChecklistItemPatch,
): ChecklistItem[] {
  const current = items.find((i) => i.id === id);
  if (!current) return items;
  const changed: ChecklistItem = {
    ...current,
    ...(patch.done !== undefined ? { done: patch.done } : {}),
    ...(patch.text !== undefined ? { text: patch.text } : {}),
  };
  if (!patch.move) return items.map((i) => (i.id === id ? changed : i));
  const rest = items.filter((i) => i.id !== id);
  const { afterId, beforeId } = patch.move;
  let at = rest.length;
  if (beforeId)
    at = Math.max(
      0,
      rest.findIndex((i) => i.id === beforeId),
    );
  else if (afterId) at = rest.findIndex((i) => i.id === afterId) + 1;
  rest.splice(at, 0, changed);
  return rest;
}
