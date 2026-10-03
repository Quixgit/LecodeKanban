import { api, unwrap, type components } from '@/shared/api';

export type IntegrationEntry = components['schemas']['IntegrationEntry'];
export type IntegrationList = components['schemas']['IntegrationList'];
export type IntegrationPatch = components['schemas']['IntegrationPatch'];
export type Meeting = components['schemas']['Meeting'];
export type Provider = IntegrationEntry['provider'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });
const one = (workspaceId: string, provider: Provider) => ({
  params: { path: { workspaceId, provider } },
});

export const integrationsApi = {
  list: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/integrations', ws(workspaceId))),
  meetings: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/integrations/meetings', ws(workspaceId))),
  connect: (workspaceId: string, provider: Provider) =>
    unwrap(
      api.POST(
        '/workspaces/{workspaceId}/integrations/{provider}/connect',
        one(workspaceId, provider),
      ),
    ),
  update: (workspaceId: string, provider: Provider, body: IntegrationPatch) =>
    unwrap(
      api.PATCH('/workspaces/{workspaceId}/integrations/{provider}', {
        ...one(workspaceId, provider),
        body,
      }),
    ),
  disconnect: (workspaceId: string, provider: Provider) =>
    unwrap(
      api.DELETE('/workspaces/{workspaceId}/integrations/{provider}', one(workspaceId, provider)),
    ),
  sync: (workspaceId: string, provider: Provider) =>
    unwrap(
      api.POST(
        '/workspaces/{workspaceId}/integrations/{provider}/sync',
        one(workspaceId, provider),
      ),
    ),
};
