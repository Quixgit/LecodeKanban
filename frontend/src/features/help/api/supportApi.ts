import { api, unwrap, type components } from '@/shared/api';

export type SupportRequest = components['schemas']['SupportRequest'];
export type SupportRequestInput = components['schemas']['SupportRequestInput'];
export type SupportStatus = components['schemas']['SupportStatus'];
export type SupportKind = components['schemas']['SupportKind'];
export type BuildInfo = components['schemas']['BuildInfo'];

export const supportApi = {
  list: (workspaceId: string, query: { status?: SupportStatus; mine?: boolean }) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/support', { params: { path: { workspaceId }, query } }),
    ),
  create: (workspaceId: string, body: SupportRequestInput) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/support', { params: { path: { workspaceId } }, body }),
    ),
  setStatus: (requestId: string, status: SupportStatus) =>
    unwrap(
      api.PATCH('/support/{requestId}', { params: { path: { requestId } }, body: { status } }),
    ),
  buildInfo: () => unwrap(api.GET('/meta')),
};

/** Where a request's screenshot is served (the session cookie authorises it). */
export const screenshotUrl = (requestId: string) => `/api/v1/support/${requestId}/screenshot`;
