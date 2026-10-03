import { api, unwrap, type components } from '@/shared/api';

export type GithubSummary = components['schemas']['GithubSummary'];
export type GithubRules = components['schemas']['GithubRules'];
export type GithubPatch = components['schemas']['GithubPatch'];
export type GithubRepo = components['schemas']['GithubRepo'];
export type GithubLink = components['schemas']['GithubLink'];
export type GithubPanel = components['schemas']['GithubPanel'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });
const card = (cardId: string) => ({ params: { path: { cardId } } });

export const githubApi = {
  get: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/github', ws(workspaceId))),
  connect: (workspaceId: string, token: string) =>
    unwrap(
      api.PUT('/workspaces/{workspaceId}/github/token', { ...ws(workspaceId), body: { token } }),
    ),
  update: (workspaceId: string, body: GithubPatch) =>
    unwrap(api.PATCH('/workspaces/{workspaceId}/github', { ...ws(workspaceId), body })),
  disconnect: (workspaceId: string) =>
    unwrap(api.DELETE('/workspaces/{workspaceId}/github', ws(workspaceId))),
  available: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/github/repos/available', ws(workspaceId))),
  link: (workspaceId: string, projectId: string, repo: string) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/github/repos', {
        ...ws(workspaceId),
        body: { projectId, repo },
      }),
    ),
  unlink: (workspaceId: string, repoId: string) =>
    unwrap(
      api.DELETE('/workspaces/{workspaceId}/github/repos/{repoId}', {
        params: { path: { workspaceId, repoId } },
      }),
    ),
  panel: (cardId: string) => unwrap(api.GET('/cards/{cardId}/github', card(cardId))),
  createIssue: (cardId: string) => unwrap(api.POST('/cards/{cardId}/github/issue', card(cardId))),
};
