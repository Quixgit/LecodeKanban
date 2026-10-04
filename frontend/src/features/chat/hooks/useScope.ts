import { useQuery } from '@tanstack/react-query';
import { chatApi } from '../api/chatApi';
import { visibleUnread } from '../model/channels';
import { chatKeys } from './useChat';

export type ScopeKind = 'project' | 'card';

/** The conversation of a project or card. The first visit creates it and joins the caller. */
export function useScopeChannel(kind: ScopeKind, id: string | undefined) {
  return useQuery({
    queryKey: chatKeys.scope(kind, id ?? ''),
    queryFn: () => (kind === 'project' ? chatApi.openProjectChat(id!) : chatApi.openCardChat(id!)),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Unread count for the badge on a Kanban button, without rendering the conversation. */
export function useScopeUnread(kind: ScopeKind, id: string | undefined) {
  const { data } = useScopeChannel(kind, id);
  return data ? visibleUnread(data) : 0;
}
