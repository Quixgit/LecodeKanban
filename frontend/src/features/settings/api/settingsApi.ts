import { api, unwrap, type components } from '@/shared/api';

export type WorkspaceSettings = components['schemas']['WorkspaceSettings'];
export type WorkspaceSettingsPatch = components['schemas']['WorkspaceSettingsPatch'];
export type WorkspaceFeatures = components['schemas']['WorkspaceFeatures'];
export type AuditEntry = components['schemas']['AuditEntry'];
export type MailStatus = components['schemas']['MailStatus'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const settingsApi = {
  get: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/settings', ws(workspaceId))),
  update: (workspaceId: string, body: WorkspaceSettingsPatch) =>
    unwrap(api.PATCH('/workspaces/{workspaceId}/settings', { ...ws(workspaceId), body })),
  mailStatus: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/mail', ws(workspaceId))),
  sendTestMail: (workspaceId: string) =>
    unwrap(api.POST('/workspaces/{workspaceId}/mail/test', ws(workspaceId))),
  audit: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/audit', ws(workspaceId))),
};
