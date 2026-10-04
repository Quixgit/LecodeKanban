import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onRealtime } from '@/features/realtime';
import type { ChatChannel } from '@/features/chat';
import { freshIds, soundFor } from '@/features/notifications';
import type { components } from '@/shared/api';
import { detectChatSound, type ChannelCounts } from '../model/detect';
import { playSound, strongest, unlockAudioOnGesture, type SoundKind } from '../model/synth';
import { soundAllowed, useSoundStore } from '../store/soundStore';

const BATCH_MS = 300;
const MIN_GAP_MS = 800;

function counts(list: readonly ChatChannel[]): Map<string, ChannelCounts> {
  return new Map(
    list.map((c) => [
      c.id,
      { unread: c.unread, mentions: c.mentions, notify: c.notify, joined: c.joined, feed: c.feed },
    ]),
  );
}

/** The conversation on screen right now, if the person is actually looking at it. */
function watchedChannel(): string | undefined {
  if (document.hidden || !document.hasFocus()) return undefined;
  return /^\/chat\/([0-9a-f-]{36})/.exec(window.location.pathname)?.[1];
}

/**
 * Plays a short, pleasant signal for new chat messages and mentions, new tasks and new comments.
 * Chat sounds follow the channel list (so muted channels, your own messages and the conversation
 * you are reading stay silent); the rest follow live hints from other people.
 */
export function useNotificationSounds(me: string | undefined, ws: string | undefined) {
  const qc = useQueryClient();

  useEffect(() => unlockAudioOnGesture(), []);

  useEffect(() => {
    if (!me || !ws) return;
    // "Do not disturb" silences everything; the status comes from the cached presence data.
    const isDnd = () =>
      qc
        .getQueryData<{ statuses: { userId: string; kind: string }[] }>(['chat', 'presence', ws])
        ?.statuses.some((s) => s.userId === me && s.kind === 'dnd') ?? false;
    let queue: SoundKind[] = [];
    let timer: number | undefined;
    let lastPlayed = 0;
    const flush = () => {
      timer = undefined;
      const kind = strongest(queue);
      queue = [];
      if (!kind || !soundAllowed(kind) || isDnd() || Date.now() - lastPlayed < MIN_GAP_MS) return;
      lastPlayed = Date.now();
      playSound(kind, useSoundStore.getState().volume);
    };
    const ring = (kind: SoundKind) => {
      queue.push(kind);
      timer ??= window.setTimeout(flush, BATCH_MS);
    };

    // Chat: watch the cached channel list for growth in unread / mention counts.
    let previous: Map<string, ChannelCounts> | null = null;
    const unsubscribeCache = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key[0] !== 'chat' || key[1] !== 'channels' || key[2] !== ws) return;
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const list = event.query.state.data as ChatChannel[] | undefined;
      if (!list) return;
      const next = counts(list);
      if (previous) {
        const kind = detectChatSound(previous, next, watchedChannel());
        if (kind) ring(kind);
      }
      previous = next; // the first load only sets the baseline
    });

    // The bell: assignments and updates on your tasks (chat kinds already ring through the list).
    let seen: Set<string> | null = null;
    const unsubscribeBell = qc.getQueryCache().subscribe((event) => {
      const key = event.query.queryKey;
      if (key[0] !== 'notifications' || key[1] !== ws || key[2] !== me) return;
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const first = (
        event.query.state.data as
          InfiniteData<components['schemas']['NotificationPage']> | undefined
      )?.pages[0]?.items;
      if (!first) return;
      const fresh = new Set(freshIds(seen, first));
      for (const n of first) {
        const kind = fresh.has(n.id) ? soundFor(n) : undefined;
        if (kind) ring(kind);
      }
      seen = new Set(first.map((n) => n.id)); // the first load only sets the baseline
    });

    // Boards: hints from other people.
    const offRealtime = onRealtime((m) => {
      if (m.workspaceId !== ws || m.actorId === me) return;
      if (m.type === 'card.created') ring('task');
      else if (m.type === 'comment.created') ring('notify');
    });

    return () => {
      unsubscribeCache();
      unsubscribeBell();
      offRealtime();
      window.clearTimeout(timer);
    };
  }, [qc, me, ws]);
}
