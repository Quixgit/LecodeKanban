import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useSession } from '@/features/auth';
import { notificationsApi, type NotificationPage } from '../api/notificationsApi';

/** The realtime layer refreshes this key when a notification hint names the person. */
export const notificationKeys = {
  all: (ws: string, user: string) => ['notifications', ws, user] as const,
};

/** The caller's notifications in the current workspace, newest first, loaded a page at a time. */
export function useNotifications() {
  const { workspace } = useCurrentWorkspace();
  const { user } = useSession();
  const ws = workspace?.id ?? '';
  const me = user?.id ?? '';
  const query = useInfiniteQuery({
    queryKey: notificationKeys.all(ws, me),
    enabled: !!ws && !!me,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => notificationsApi.list(ws, pageParam),
    getNextPageParam: (last: NotificationPage) => last.next ?? undefined,
    staleTime: 30_000,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = query.data?.pages[0]?.unread ?? 0;
  return { query, items, unread, ws, me };
}

export function useMarkNotifications(ws: string, me: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { ids?: string[]; all?: boolean }) => notificationsApi.markRead(ws, body),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationKeys.all(ws, me) }),
  });
}
