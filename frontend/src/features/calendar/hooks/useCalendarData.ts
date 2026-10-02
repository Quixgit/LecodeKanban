import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  cardKeys,
  cardsApi,
  patchCached,
  useCardMutations,
  type BoardQuery,
  type Card,
} from '@/features/cards';

/** Every card matching the filters (the calendar places them by due date client-side). */
export function useCalendarCards(workspaceId: string | undefined, query: BoardQuery) {
  return useQuery({
    queryKey: cardKeys.board(workspaceId ?? '', query),
    queryFn: () => cardsApi.board(workspaceId!, query),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

/** Moves a card to another day (or schedules it): optimistic, rolled back if the server refuses. */
export function useReschedule(workspaceId: string) {
  const qc = useQueryClient();
  const { update } = useCardMutations(workspaceId);
  return useCallback(
    (card: Card, day: string, onError: (e: unknown) => void) => {
      if (card.dueDate === day) return;
      patchCached(qc, workspaceId, card.id, (c) => ({ ...c, dueDate: day }));
      update.mutate(
        { id: card.id, patch: { version: card.version, dueDate: day } },
        {
          onError: (e) => {
            patchCached(qc, workspaceId, card.id, () => card);
            void qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) });
            onError(e);
          },
        },
      );
    },
    [qc, update, workspaceId],
  );
}
