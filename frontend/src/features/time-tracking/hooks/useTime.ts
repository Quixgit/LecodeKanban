import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { timeApi, type TimesheetQuery } from '../api/timeApi';

export const timeKeys = {
  all: ['time'] as const,
  card: (cardId: string) => ['time', 'card', cardId] as const,
  running: ['time', 'running'] as const,
  sheet: (ws: string, q: TimesheetQuery) => ['time', 'sheet', ws, q] as const,
};

export function useTimeEntries(cardId: string) {
  return useQuery({ queryKey: timeKeys.card(cardId), queryFn: () => timeApi.list(cardId) });
}

/** One person's entries for a period (the timesheet and the header's "today" list). */
export function useTimesheet(
  workspaceId: string | undefined,
  query: TimesheetQuery,
  enabled = true,
  live = false,
) {
  return useQuery({
    queryKey: timeKeys.sheet(workspaceId ?? '', query),
    queryFn: () => timeApi.timesheet(workspaceId!, query),
    enabled: !!workspaceId && enabled,
    placeholderData: keepPreviousData,
    // A running timer's seconds grow on the server: look again now and then.
    refetchInterval: live ? 30_000 : false,
  });
}

/** The signed-in user's running timer (at most one, across all cards). */
export function useRunningTimer() {
  return useQuery({
    queryKey: timeKeys.running,
    queryFn: timeApi.running,
    select: (r) => r.entry ?? null,
    staleTime: 30_000,
  });
}

export function useTimeMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: timeKeys.all });
  return {
    start: useMutation({ mutationFn: timeApi.start, onSuccess: refresh }),
    stop: useMutation({ mutationFn: timeApi.stop, onSuccess: refresh }),
    log: useMutation({
      mutationFn: (v: { cardId: string; seconds: number; note?: string; startedAt?: string }) =>
        timeApi.log(v.cardId, {
          seconds: v.seconds,
          note: v.note || undefined,
          startedAt: v.startedAt,
        }),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; seconds?: number; note?: string; startedAt?: string }) =>
        timeApi.update(v.id, { seconds: v.seconds, note: v.note, startedAt: v.startedAt }),
      onSuccess: refresh,
    }),
    setEstimate: useMutation({
      mutationFn: (v: { cardId: string; seconds: number | null }) =>
        timeApi.setEstimate(v.cardId, v.seconds),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: timeApi.remove, onSuccess: refresh }),
  };
}

/** Seconds elapsed since `startedAt`, re-rendering every second while `active`. */
export function useElapsed(startedAt: string | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active, startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
}
