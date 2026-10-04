import { api, unwrap, type components } from '@/shared/api';

export type MemberProfile = components['schemas']['MemberProfile'];

export const memberApi = {
  profile: (workspaceId: string, userId: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/members/{userId}', {
        params: { path: { workspaceId, userId } },
      }),
    ),
};
