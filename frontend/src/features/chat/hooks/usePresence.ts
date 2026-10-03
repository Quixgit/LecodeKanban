import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { chatApi, type ChatStatus } from '../api/chatApi';
import { chatKeys } from './useChat';

const BEAT_MS = 60_000;
const POLL_MS = 45_000;

/** Tells the server this person has the app open (while the tab is visible). */
export function usePresenceHeartbeat(ws: string | undefined) {
  useEffect(() => {
    if (!ws) return;
    const beat = () => {
      if (!document.hidden) void chatApi.heartbeat(ws).catch(() => undefined);
    };
    beat();
    const id = window.setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [ws]);
}

function usePresenceData(ws: string | undefined) {
  return useQuery({
    queryKey: chatKeys.presence(ws ?? ''),
    queryFn: () => chatApi.presence(ws!),
    enabled: !!ws,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
}

/** Who is online right now (seen within two minutes). */
export function useOnline(ws: string | undefined): ReadonlySet<string> {
  const { data } = usePresenceData(ws);
  return useMemo(() => new Set(data?.online ?? []), [data]);
}

/** Chosen statuses by person (available, busy, do not disturb, away, with icon and text). */
export function useStatuses(ws: string | undefined): ReadonlyMap<string, ChatStatus> {
  const { data } = usePresenceData(ws);
  return useMemo(() => new Map((data?.statuses ?? []).map((s) => [s.userId, s])), [data]);
}
