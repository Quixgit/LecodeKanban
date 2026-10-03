import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  chatApi,
  type ChatChannel,
  type ChatChannelInput,
  type ChatChannelPatch,
  type ChatMessage,
  type ChatMessagePage,
} from '../api/chatApi';
import type { ReactionKey } from '../model/reactions';

export const chatKeys = {
  all: ['chat'] as const,
  channels: (ws: string) => ['chat', 'channels', ws] as const,
  messages: (channel: string) => ['chat', 'messages', channel] as const,
  thread: (root: string) => ['chat', 'thread', root] as const,
  scope: (kind: string, id: string) => ['chat', 'scope', kind, id] as const,
  members: (channel: string) => ['chat', 'members', channel] as const,
  pins: (channel: string) => ['chat', 'pins', channel] as const,
  files: (channel: string) => ['chat', 'files', channel] as const,
  saved: (ws: string) => ['chat', 'saved', ws] as const,
  threads: (ws: string) => ['chat', 'threads', ws] as const,
  search: (ws: string, q: string) => ['chat', 'search', ws, q] as const,
  presence: (ws: string) => ['chat', 'presence', ws] as const,
};

export function useChannels(ws: string | undefined) {
  return useQuery({
    queryKey: chatKeys.channels(ws ?? ''),
    queryFn: () => chatApi.channels(ws!),
    enabled: !!ws,
    staleTime: 30_000,
  });
}

/** Sidebar badge: unread conversations the user has not muted. */
export function useChatUnread(ws: string | undefined) {
  const { data } = useChannels(ws);
  return useMemo(() => {
    let unread = 0;
    let mentions = 0;
    for (const c of data ?? []) {
      if (!c.joined) continue;
      mentions += c.mentions;
      if (!c.muted) unread += c.unread;
    }
    return { unread, mentions, total: Math.max(mentions, unread) };
  }, [data]);
}

type MessageData = InfiniteData<ChatMessagePage, string | undefined>;

export function useMessages(channel: string | undefined) {
  const q = useInfiniteQuery({
    queryKey: chatKeys.messages(channel ?? ''),
    queryFn: ({ pageParam }) => chatApi.messages(channel!, pageParam),
    initialPageParam: undefined as string | undefined,
    // Pages run newest to oldest; the cursor is the oldest message loaded so far.
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.id : undefined),
    enabled: !!channel,
  });
  const messages = useMemo(
    () => (q.data ? [...q.data.pages].reverse().flatMap((p) => p.messages) : []),
    [q.data],
  );
  return { ...q, messages };
}

export function usePins(channel: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.pins(channel ?? ''),
    queryFn: () => chatApi.pins(channel!),
    enabled: !!channel && enabled,
  });
}

export function useChannelFiles(channel: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.files(channel ?? ''),
    queryFn: () => chatApi.files(channel!),
    enabled: !!channel && enabled,
  });
}

export function useSavedMessages(ws: string | undefined) {
  return useQuery({
    queryKey: chatKeys.saved(ws ?? ''),
    queryFn: () => chatApi.saved(ws!),
    enabled: !!ws,
  });
}

export function useMyThreads(ws: string | undefined) {
  return useQuery({
    queryKey: chatKeys.threads(ws ?? ''),
    queryFn: () => chatApi.threads(ws!),
    enabled: !!ws,
  });
}

export function useMessageSearch(ws: string | undefined, q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: chatKeys.search(ws ?? '', term),
    queryFn: () => chatApi.search(ws!, term),
    enabled: !!ws && term.length >= 2,
    staleTime: 15_000,
  });
}

export function useThread(root: string | undefined) {
  return useQuery({
    queryKey: chatKeys.thread(root ?? ''),
    queryFn: () => chatApi.thread(root!),
    enabled: !!root,
  });
}

export function useChannelMembers(channel: string | undefined, enabled = true) {
  return useQuery({
    queryKey: chatKeys.members(channel ?? ''),
    queryFn: () => chatApi.members(channel!),
    enabled: !!channel && enabled,
  });
}

/** Replaces one message wherever the caches hold it (history page or thread). */
function patchMessage(qc: QueryClient, next: ChatMessage) {
  qc.setQueryData<MessageData>(
    chatKeys.messages(next.channelId),
    (d) =>
      d && {
        ...d,
        pages: d.pages.map((p) => ({
          ...p,
          messages: p.messages.map((m) => (m.id === next.id ? next : m)),
        })),
      },
  );
  qc.setQueryData<ChatMessage[]>(
    chatKeys.thread(next.parentId ?? next.id),
    (d) => d && d.map((m) => (m.id === next.id ? next : m)),
  );
}

/** Appends a just-sent message unless a realtime refetch already delivered it. */
function appendMessage(qc: QueryClient, msg: ChatMessage) {
  if (msg.parentId) {
    qc.setQueryData<ChatMessage[]>(chatKeys.thread(msg.parentId), (d) =>
      d && !d.some((m) => m.id === msg.id) ? [...d, msg] : d,
    );
    void qc.invalidateQueries({ queryKey: chatKeys.messages(msg.channelId) });
    return;
  }
  qc.setQueryData<MessageData>(chatKeys.messages(msg.channelId), (d) => {
    if (!d || d.pages.some((p) => p.messages.some((m) => m.id === msg.id))) return d;
    const [first, ...rest] = d.pages;
    return first && { ...d, pages: [{ ...first, messages: [...first.messages, msg] }, ...rest] };
  });
}

export function useChatMutations(ws: string) {
  const qc = useQueryClient();
  const channels = () => qc.invalidateQueries({ queryKey: chatKeys.channels(ws) });
  const upsertChannel = (c: ChatChannel) => {
    qc.setQueryData<ChatChannel[]>(chatKeys.channels(ws), (d) =>
      d ? (d.some((x) => x.id === c.id) ? d.map((x) => (x.id === c.id ? c : x)) : [...d, c]) : d,
    );
    void channels();
  };

  return {
    createChannel: useMutation({
      mutationFn: (body: ChatChannelInput) => chatApi.createChannel(ws, body),
      onSuccess: upsertChannel,
    }),
    openDirect: useMutation({
      mutationFn: (userIds: string[]) => chatApi.openDirect(ws, userIds),
      onSuccess: upsertChannel,
    }),
    updateChannel: useMutation({
      mutationFn: (v: { id: string; patch: ChatChannelPatch }) =>
        chatApi.updateChannel(v.id, v.patch),
      onSuccess: upsertChannel,
    }),
    join: useMutation({ mutationFn: chatApi.join, onSuccess: upsertChannel }),
    leave: useMutation({ mutationFn: chatApi.leave, onSuccess: channels }),
    archive: useMutation({ mutationFn: chatApi.archiveChannel, onSuccess: channels }),
    addMembers: useMutation({
      mutationFn: (v: { id: string; userIds: string[] }) => chatApi.addMembers(v.id, v.userIds),
      onSuccess: (_d, v) => {
        void qc.invalidateQueries({ queryKey: chatKeys.members(v.id) });
        void channels();
      },
    }),
    mute: useMutation({
      mutationFn: (v: { id: string; muted: boolean }) => chatApi.mute(v.id, v.muted),
      onSuccess: channels,
    }),
    markRead: useMutation({
      mutationFn: chatApi.markRead,
      onSuccess: (_d, id) => {
        // Clear the badge immediately; the realtime hint confirms it.
        qc.setQueryData<ChatChannel[]>(chatKeys.channels(ws), (d) =>
          d?.map((c) => (c.id === id ? { ...c, unread: 0, mentions: 0 } : c)),
        );
        qc.setQueriesData<ChatChannel>({ queryKey: ['chat', 'scope'] }, (d) =>
          d?.id === id ? { ...d, unread: 0, mentions: 0 } : d,
        );
      },
    }),
    post: useMutation({
      mutationFn: (v: { channel: string; body: string; parentId?: string; fileIds?: string[] }) =>
        chatApi.post(v.channel, v.body, v.parentId, v.fileIds),
      onSuccess: (msg) => {
        appendMessage(qc, msg);
        void channels();
      },
    }),
    edit: useMutation({
      mutationFn: (v: { id: string; body: string }) => chatApi.edit(v.id, v.body),
      onSuccess: (msg) => patchMessage(qc, msg),
    }),
    remove: useMutation({
      mutationFn: (m: ChatMessage) => chatApi.remove(m.id),
      onSuccess: (_d, m) => {
        void qc.invalidateQueries({ queryKey: chatKeys.messages(m.channelId) });
        if (m.parentId) void qc.invalidateQueries({ queryKey: chatKeys.thread(m.parentId) });
        else void qc.invalidateQueries({ queryKey: chatKeys.thread(m.id) });
      },
    }),
    star: useMutation({
      mutationFn: (v: { id: string; on: boolean }) => chatApi.star(v.id, v.on),
      onSuccess: channels,
    }),
    save: useMutation({
      mutationFn: (v: { message: ChatMessage; on: boolean }) => chatApi.save(v.message.id, v.on),
      onSuccess: (msg) => {
        patchMessage(qc, msg as ChatMessage);
        void qc.invalidateQueries({ queryKey: chatKeys.saved(ws) });
      },
    }),
    pin: useMutation({
      mutationFn: (v: { message: ChatMessage; on: boolean }) => chatApi.pin(v.message.id, v.on),
      onSuccess: (msg) => {
        patchMessage(qc, msg as ChatMessage);
        void qc.invalidateQueries({ queryKey: chatKeys.pins(msg.channelId) });
      },
    }),
    react: useMutation({
      mutationFn: (v: { message: ChatMessage; key: ReactionKey; on: boolean }) =>
        chatApi.react(v.message.id, v.key, v.on),
      onSuccess: (msg) => patchMessage(qc, msg),
    }),
  };
}
