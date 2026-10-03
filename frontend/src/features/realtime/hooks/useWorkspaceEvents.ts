import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiBaseUrl, refreshSession } from '@/shared/api';
import { emitRealtime } from '../model/bus';
import { useRealtimeStore } from '../model/gate';
import {
  keysFor,
  mergeKeys,
  resyncKeys,
  type QueryKeyPrefix,
  type RealtimeMessage,
} from '../model/invalidation';

const FLUSH_MS = 150;
const MAX_BACKOFF_MS = 30_000;
/** A hidden tab drops its stream after this long (browsers allow ~6 connections per origin over HTTP/1.1). */
const HIDDEN_CLOSE_MS = 30_000;

export function eventsUrl(workspaceId: string) {
  return `${apiBaseUrl.replace(/\/$/, '')}/workspaces/${workspaceId}/events`;
}

/**
 * Keeps the workspace's cached data fresh from the server's SSE hints. Bursts are coalesced,
 * refetches wait while an interaction holds the gate, and a stream that fails (e.g. an expired
 * access token) is reopened after refreshing the session with exponential backoff.
 */
export function useWorkspaceEvents(workspaceId: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId || typeof EventSource === 'undefined') return;
    const setConnection = useRealtimeStore.getState().setConnection;
    const pending = new Map<string, QueryKeyPrefix>();
    let flushTimer: number | undefined;
    let retryTimer: number | undefined;
    let backoff = 2000;
    let source: EventSource | null = null;
    let hideTimer: number | undefined;
    let disposed = false;

    const flush = () => {
      flushTimer = undefined;
      if (useRealtimeStore.getState().holds > 0) {
        flushTimer = window.setTimeout(flush, FLUSH_MS);
        return;
      }
      const keys = [...pending.values()];
      pending.clear();
      for (const queryKey of keys) void qc.invalidateQueries({ queryKey });
    };
    const schedule = (keys: QueryKeyPrefix[]) => {
      mergeKeys(pending, keys);
      flushTimer ??= window.setTimeout(flush, FLUSH_MS);
    };

    const connect = () => {
      if (disposed) return;
      setConnection('connecting');
      source = new EventSource(eventsUrl(workspaceId), { withCredentials: true });
      source.addEventListener('ready', () => {
        setConnection('live');
        backoff = 2000;
      });
      source.addEventListener('change', (e) => {
        try {
          const msg = JSON.parse((e as MessageEvent<string>).data) as RealtimeMessage;
          emitRealtime(msg);
          schedule(keysFor(msg));
        } catch {
          // Malformed hint: ignore, the next one (or a resync) heals the cache.
        }
      });
      source.addEventListener('resync', () => schedule(resyncKeys(workspaceId)));
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED) {
          setConnection('connecting'); // the browser retries on its own
          return;
        }
        setConnection('offline');
        source.close();
        retryTimer = window.setTimeout(async () => {
          await refreshSession();
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
          schedule(resyncKeys(workspaceId)); // we may have missed changes while away
          connect();
        }, backoff);
      };
    };
    connect();

    // Background tabs would each hold a connection open and starve the foreground tab's requests.
    const onVisibility = () => {
      window.clearTimeout(hideTimer);
      if (document.hidden) {
        hideTimer = window.setTimeout(() => {
          window.clearTimeout(retryTimer);
          source?.close();
          source = null;
          setConnection('offline');
        }, HIDDEN_CLOSE_MS);
      } else if (!source || source.readyState === EventSource.CLOSED) {
        schedule(resyncKeys(workspaceId)); // changes may have happened while away
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(hideTimer);
      disposed = true;
      source?.close();
      window.clearTimeout(flushTimer);
      window.clearTimeout(retryTimer);
    };
  }, [qc, workspaceId]);
}
