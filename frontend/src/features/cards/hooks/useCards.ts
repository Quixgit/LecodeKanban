import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import {
  cardsApi,
  type BoardQuery,
  type BulkCardAction,
  type Card,
  type CardBoard,
  type CardCountQuery,
  type CardInput,
  type CardMove,
  type CardPatch,
  type CardQuery,
} from '../api/cardsApi';

export const cardKeys = {
  all: (ws: string) => ['cards', ws] as const,
  list: (ws: string, q: CardQuery) => ['cards', ws, 'list', q] as const,
  counts: (ws: string, q: CardCountQuery) => ['cards', ws, 'counts', q] as const,
  stats: (ws: string, days: number) => ['cards', ws, 'stats', days] as const,
  board: (ws: string, q: BoardQuery) => ['cards', ws, 'board', q] as const,
  one: (id: string) => ['card', id] as const,
  trash: (ws: string, project?: string) => ['cards', ws, 'trash', project ?? 'all'] as const,
};

export function useCard(id: string | undefined) {
  return useQuery({
    queryKey: cardKeys.one(id ?? ''),
    queryFn: () => cardsApi.get(id!),
    enabled: !!id,
  });
}

export function useCardList(workspaceId: string | undefined, query: CardQuery, enabled = true) {
  return useQuery({
    queryKey: cardKeys.list(workspaceId ?? '', query),
    queryFn: () => cardsApi.list(workspaceId!, query),
    enabled: !!workspaceId && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useCardCounts(workspaceId: string | undefined, query: CardCountQuery) {
  return useQuery({
    queryKey: cardKeys.counts(workspaceId ?? '', query),
    queryFn: () => cardsApi.counts(workspaceId!, query),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export function useCardStats(workspaceId: string | undefined, days: number) {
  return useQuery({
    queryKey: cardKeys.stats(workspaceId ?? '', days),
    queryFn: () => cardsApi.stats(workspaceId!, days),
    enabled: !!workspaceId,
  });
}

type Page = { items: Card[]; total: number; page: number; pageSize: number };

/** Applies fn to every cached copy of a card (list pages, boards, detail) — for optimistic edits. */
export function patchCached(qc: QueryClient, ws: string, id: string, fn: (c: Card) => Card) {
  qc.setQueriesData<Page>({ queryKey: [...cardKeys.all(ws), 'list'] }, (page) =>
    page ? { ...page, items: page.items.map((c) => (c.id === id ? fn(c) : c)) } : page,
  );
  qc.setQueriesData<CardBoard>({ queryKey: [...cardKeys.all(ws), 'board'] }, (b) =>
    b ? { ...b, items: b.items.map((c) => (c.id === id ? fn(c) : c)) } : b,
  );
  qc.setQueryData<Card>(cardKeys.one(id), (c) => (c ? fn(c) : c));
}

export function useCardMutations(workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
      // Project progress counters change with card status.
      qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
    ]);

  return {
    create: useMutation({
      mutationFn: (body: CardInput) => cardsApi.create(workspaceId, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: CardPatch }) => cardsApi.update(v.id, v.patch),
      onSuccess: (card) => {
        patchCached(qc, workspaceId, card.id, () => card);
        void refresh();
      },
    }),
    move: useMutation({
      mutationFn: (v: { card: Card; move: Omit<CardMove, 'version'> }) =>
        cardsApi.move(v.card.id, { ...v.move, version: v.card.version }),
      onMutate: async ({ card, move }) => {
        await qc.cancelQueries({ queryKey: cardKeys.all(workspaceId) });
        if (move.status)
          patchCached(qc, workspaceId, card.id, (c) => ({ ...c, status: move.status! }));
      },
      onSettled: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => cardsApi.remove(id), onSettled: refresh }),
    bulk: useMutation({
      mutationFn: (body: BulkCardAction) => cardsApi.bulk(workspaceId, body),
      onSettled: refresh,
    }),
  };
}

/** Deleted tasks, newest first (whoever may delete tasks may look). */
export function useTrash(workspaceId: string | undefined, projectId?: string) {
  return useQuery({
    queryKey: cardKeys.trash(workspaceId ?? '', projectId),
    queryFn: () => cardsApi.trash(workspaceId!, projectId),
    enabled: !!workspaceId,
  });
}

/** Brings a task back; boards, lists and the trash refetch. */
export function useRestoreCard(workspaceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cardsApi.restore(id),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
        qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      ]),
  });
}
