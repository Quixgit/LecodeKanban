import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { chatApi } from '../api/chatApi';
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

/** Who is online right now (seen within two minutes). */
export function useOnline(ws: string | undefined): ReadonlySet<string> {
  const { data } = useQuery({
    queryKey: chatKeys.presence(ws ?? ''),
    queryFn: () => chatApi.presence(ws!),
    enabled: !!ws,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: 20_000,
  });
  return useMemo(() => new Set(data?.online ?? []), [data]);
}
