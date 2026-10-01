import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  type ProjectInput,
  type ProjectPatch,
  type ProjectQuery,
} from '../api/projectsApi';

export const projectKeys = {
  all: (ws: string) => ['projects', ws] as const,
  list: (ws: string, q: ProjectQuery) => ['projects', ws, 'list', q] as const,
  summary: (ws: string) => ['projects', ws, 'summary'] as const,
  one: (id: string) => ['project', id] as const,
};

export function useProjectList(workspaceId: string | undefined, query: ProjectQuery) {
  return useQuery({
    queryKey: projectKeys.list(workspaceId ?? '', query),
    queryFn: () => projectsApi.list(workspaceId!, query),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}

export function useProjectSummary(workspaceId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.summary(workspaceId ?? ''),
    queryFn: () => projectsApi.summary(workspaceId!),
    enabled: !!workspaceId,
  });
}

/** All (non-archived) projects of a workspace, for pickers. */
export function useAllProjects(workspaceId: string | undefined) {
  return useProjectList(workspaceId, { sort: 'name', order: 'asc', pageSize: 500 });
}

export function useProjectMutations(workspaceId: string) {
  const qc = useQueryClient();
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: projectKeys.all(workspaceId) }),
      // Cards embed project names/keys; dashboards embed project progress.
      qc.invalidateQueries({ queryKey: ['cards', workspaceId] }),
    ]);
  return {
    create: useMutation({
      mutationFn: (body: ProjectInput) => projectsApi.create(workspaceId, body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (v: { id: string; patch: ProjectPatch }) => projectsApi.update(v.id, v.patch),
      onSuccess: invalidate,
    }),
    archive: useMutation({
      mutationFn: (id: string) => projectsApi.archive(id),
      onSuccess: invalidate,
    }),
  };
}
