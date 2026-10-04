import { api, unwrap, type components } from '@/shared/api';

export type WorkspaceSettings = components['schemas']['WorkspaceSettings'];
export type WorkspaceSettingsPatch = components['schemas']['WorkspaceSettingsPatch'];
export type WorkspaceFeatures = components['schemas']['WorkspaceFeatures'];
export type AuditEntry = components['schemas']['AuditEntry'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });

export const settingsApi = {
  get: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/settings', ws(workspaceId))),
  update: (workspaceId: string, body: WorkspaceSettingsPatch) =>
    unwrap(api.PATCH('/workspaces/{workspaceId}/settings', { ...ws(workspaceId), body })),
  audit: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/audit', ws(workspaceId))),
};
