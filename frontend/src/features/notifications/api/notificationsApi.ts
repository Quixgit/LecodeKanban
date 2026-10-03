import { api, unwrap, type components } from '@/shared/api';

export type AppNotification = components['schemas']['Notification'];
export type NotificationPage = components['schemas']['NotificationPage'];
export type NotificationKind = AppNotification['kind'];

export const notificationsApi = {
  list: (workspaceId: string, before?: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/notifications', {
        params: { path: { workspaceId }, query: { before, limit: 30 } },
      }),
    ),
  markRead: (workspaceId: string, body: { ids?: string[]; all?: boolean }) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/notifications/read', {
        params: { path: { workspaceId } },
        body,
      }),
    ),
};
