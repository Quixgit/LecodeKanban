import { api, unwrap, type components, type paths } from '@/shared/api';

export type Project = components['schemas']['Project'];
export type ProjectInput = components['schemas']['ProjectInput'];
export type ProjectPatch = components['schemas']['ProjectPatch'];
export type ProjectSummary = components['schemas']['ProjectSummary'];
export type ProjectStatus = components['schemas']['ProjectStatus'];
export type ProjectIcon = components['schemas']['ProjectIcon'];
export type Tone = components['schemas']['Tone'];
export type ProjectQuery = NonNullable<
  paths['/workspaces/{workspaceId}/projects']['get']['parameters']['query']
>;

export const projectsApi = {
  list: (workspaceId: string, query: ProjectQuery) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/projects', { params: { path: { workspaceId }, query } }),
    ),
  summary: (workspaceId: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/projects/summary', { params: { path: { workspaceId } } }),
    ),
  get: (projectId: string) =>
    unwrap(api.GET('/projects/{projectId}', { params: { path: { projectId } } })),
  create: (workspaceId: string, body: ProjectInput) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/projects', { params: { path: { workspaceId } }, body }),
    ),
  update: (projectId: string, body: ProjectPatch) =>
    unwrap(api.PATCH('/projects/{projectId}', { params: { path: { projectId } }, body })),
  archive: (projectId: string) =>
    unwrap(api.DELETE('/projects/{projectId}', { params: { path: { projectId } } })),
};
