import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentWorkspace } from '@/features/workspaces';
import { githubApi, type GithubPatch } from '../api/githubApi';

/** The realtime layer refreshes ['github', ws] and ['github', 'card', id] on GitHub hints. */
export const githubKeys = {
  summary: (ws: string) => ['github', ws] as const,
  available: (ws: string) => ['github', ws, 'available'] as const,
  card: (cardId: string) => ['github', 'card', cardId] as const,
};

export function useGithub() {
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  return useQuery({
    queryKey: githubKeys.summary(ws),
    enabled: !!ws,
    queryFn: () => githubApi.get(ws),
  });
}

export function useGithubRepos(enabled: boolean) {
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  return useQuery({
    queryKey: githubKeys.available(ws),
    enabled: enabled && !!ws,
    queryFn: () => githubApi.available(ws),
    staleTime: 0,
  });
}

export function useGithubMutations() {
  const { workspace } = useCurrentWorkspace();
  const ws = workspace?.id ?? '';
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['github'] });
  return {
    connect: useMutation({
      mutationFn: (token: string) => githubApi.connect(ws, token),
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: (p: GithubPatch) => githubApi.update(ws, p),
      onSuccess: refresh,
    }),
    disconnect: useMutation({ mutationFn: () => githubApi.disconnect(ws), onSuccess: refresh }),
    link: useMutation({
      mutationFn: (v: { projectId: string; repo: string }) =>
        githubApi.link(ws, v.projectId, v.repo),
      onSuccess: refresh,
    }),
    unlink: useMutation({
      mutationFn: (repoId: string) => githubApi.unlink(ws, repoId),
      onSuccess: refresh,
    }),
  };
}

/** What a card shows about GitHub: linked pull requests and issues, the branch name, the issue button. */
export function useCardGithub(cardId: string) {
  return useQuery({
    queryKey: githubKeys.card(cardId),
    queryFn: () => githubApi.panel(cardId),
    staleTime: 15_000,
  });
}

export function useCreateIssue(cardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => githubApi.createIssue(cardId),
    onSuccess: () => qc.invalidateQueries({ queryKey: githubKeys.card(cardId) }),
  });
}
