import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  STATUSES,
  cardKeys,
  cardsApi,
  type BoardQuery,
  type Card,
  type CardBoard,
} from '@/features/cards';
import { kanbanApi, type ColumnInput, type ColumnPatch, type Neighbours } from '../api/kanbanApi';
import type { BoardMode, ColumnDef } from '../model/board';
import { applyPlan, type MovePlan } from '../model/move';

export const columnKeys = { board: (projectId: string) => ['boardColumns', projectId] as const };

/** Columns of the current board: the project's own, or one per status. */
export function useBoardColumns(mode: BoardMode) {
  const { t } = useTranslation('common');
  const projectId = mode.kind === 'project' ? mode.projectId : '';
  const q = useQuery({
    queryKey: columnKeys.board(projectId),
    queryFn: () => kanbanApi.board(projectId),
    enabled: mode.kind === 'project',
  });
  const columns = useMemo<ColumnDef[] | undefined>(() => {
    if (mode.kind === 'all') {
      return STATUSES.map((s) => ({ key: s, name: t(`status.${s}`), status: s, wipLimit: null }));
    }
    return q.data?.columns.map((c) => ({
      key: c.id,
      columnId: c.id,
      name: c.name,
      status: c.status,
      wipLimit: c.wipLimit ?? null,
    }));
  }, [mode.kind, q.data, t]);
  return { columns, isPending: mode.kind === 'project' && q.isPending, error: q.error };
}

export function useBoardCards(workspaceId: string | undefined, query: BoardQuery) {
  return useQuery({
    queryKey: cardKeys.board(workspaceId ?? '', query),
    queryFn: () => cardsApi.board(workspaceId!, query),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

/**
 * Commits a drop: the move (and, across swimlanes, the lane's field) with an optimistic board
 * update that is rolled back if the server refuses (e.g. someone else moved the card first).
 */
export function useBoardMove(
  workspaceId: string,
  query: BoardQuery,
  people: Record<string, Card['assignees'][number]>,
) {
  const qc = useQueryClient();
  const key = cardKeys.board(workspaceId, query);
  return useMutation({
    mutationFn: async (plan: MovePlan) => {
      const moved = await cardsApi.move(plan.card.id, { ...plan.move, version: plan.card.version });
      if (!plan.lanePatch) return moved;
      return cardsApi.update(moved.id, { version: moved.version, ...plan.lanePatch });
    },
    onMutate: async (plan) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<CardBoard>(key);
      if (previous)
        qc.setQueryData<CardBoard>(key, {
          ...previous,
          items: applyPlan(previous.items, plan, people),
        });
      return { previous };
    },
    onError: (_e, _plan, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
        qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
      ]),
  });
}

export function useColumnMutations(projectId: string, workspaceId: string) {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: columnKeys.board(projectId) }),
      qc.invalidateQueries({ queryKey: cardKeys.all(workspaceId) }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: ColumnInput) => kanbanApi.createColumn(projectId, body),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: ColumnPatch }) => kanbanApi.updateColumn(v.id, v.patch),
      onSuccess: refresh,
    }),
    move: useMutation({
      mutationFn: (v: { id: string; to: Neighbours }) => kanbanApi.moveColumn(v.id, v.to),
      onSettled: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => kanbanApi.deleteColumn(id),
      onSuccess: refresh,
    }),
  };
}
