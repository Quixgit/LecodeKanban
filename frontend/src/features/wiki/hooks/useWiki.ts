import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { applyMove, type Placement } from '../model/tree';
import {
  wikiApi,
  type WikiMoveInput,
  type WikiNodeInput,
  type WikiNodePatch,
  type WikiRoleName,
  type WikiSpaceInput,
  type WikiSpacePatch,
  type WikiTarget,
  type WikiTreeDto,
  type WikiVisibilityName,
  type WikiWorkspaceRole,
} from '../api/wikiApi';

export const wikiKeys = {
  all: ['wiki'] as const,
  spaces: (ws: string) => ['wiki', 'spaces', ws] as const,
  tree: (space: string) => ['wiki', 'tree', space] as const,
  node: (id: string) => ['wiki', 'node', id] as const,
  list: (ws: string, kind: 'favorites' | 'recent' | 'shared' | 'mine' | 'trash') =>
    ['wiki', 'list', ws, kind] as const,
  access: (t: WikiTarget) => ['wiki', 'access', t.nodeId ?? t.spaceId] as const,
};

export function useSpaces(ws: string | undefined) {
  return useQuery({
    queryKey: wikiKeys.spaces(ws ?? ''),
    queryFn: () => wikiApi.spaces(ws!),
    enabled: !!ws,
  });
}

export function useTree(spaceId: string | undefined) {
  return useQuery({
    queryKey: wikiKeys.tree(spaceId ?? ''),
    queryFn: () => wikiApi.tree(spaceId!),
    enabled: !!spaceId,
  });
}

export function useNode(id: string | undefined) {
  return useQuery({
    queryKey: wikiKeys.node(id ?? ''),
    queryFn: () => wikiApi.node(id!),
    enabled: !!id,
  });
}

const lists = {
  favorites: wikiApi.favorites,
  recent: wikiApi.recent,
  shared: wikiApi.shared,
  mine: wikiApi.mine,
} as const;

export function useNodeList(ws: string | undefined, kind: keyof typeof lists) {
  return useQuery({
    queryKey: wikiKeys.list(ws ?? '', kind),
    queryFn: () => lists[kind](ws!),
    enabled: !!ws,
  });
}

export function useTrash(ws: string | undefined) {
  return useQuery({
    queryKey: wikiKeys.list(ws ?? '', 'trash'),
    queryFn: () => wikiApi.trash(ws!),
    enabled: !!ws,
  });
}

export function useAccess(target: WikiTarget | null, enabled = true) {
  return useQuery({
    queryKey: wikiKeys.access(target ?? { spaceId: '' }),
    queryFn: () => wikiApi.access(target!),
    enabled: !!target && enabled,
  });
}

/** Everything the wiki shows depends on the tree, so most writes refresh all wiki queries. */
const refreshAll = (qc: QueryClient) => qc.invalidateQueries({ queryKey: wikiKeys.all });

export interface MoveVars {
  id: string;
  spaceId: string;
  placement: Placement;
  /** Destination space when it differs from the current one. */
  toSpaceId?: string;
  confirmWiden?: boolean;
}

function toBody(v: MoveVars): WikiMoveInput {
  return {
    parentId: v.placement.parentId,
    beforeId: v.placement.beforeId ?? null,
    afterId: v.placement.afterId ?? null,
    spaceId: v.toSpaceId ?? null,
    confirmWiden: v.confirmWiden ?? false,
  };
}

export function useWikiMutations(ws: string) {
  const qc = useQueryClient();
  return {
    createSpace: useMutation({
      mutationFn: (body: WikiSpaceInput) => wikiApi.createSpace(ws, body),
      onSuccess: () => refreshAll(qc),
    }),
    updateSpace: useMutation({
      mutationFn: (v: { id: string; patch: WikiSpacePatch }) => wikiApi.updateSpace(v.id, v.patch),
      onSuccess: () => refreshAll(qc),
    }),
    deleteSpace: useMutation({
      mutationFn: (id: string) => wikiApi.deleteSpace(id),
      onSuccess: () => refreshAll(qc),
    }),
    createNode: useMutation({
      mutationFn: (v: { spaceId: string; body: WikiNodeInput }) =>
        wikiApi.createNode(v.spaceId, v.body),
      onSuccess: (node) => {
        // Seed the page query so opening the new page doesn't flash a skeleton or lose its space.
        qc.setQueryData(wikiKeys.node(node.id), node);
        return refreshAll(qc);
      },
    }),
    updateNode: useMutation({
      mutationFn: (v: { id: string; patch: WikiNodePatch }) => wikiApi.updateNode(v.id, v.patch),
      onMutate: async ({ id, patch }) => {
        await qc.cancelQueries({ queryKey: ['wiki', 'tree'] });
        const snapshots = qc.getQueriesData<WikiTreeDto>({ queryKey: ['wiki', 'tree'] });
        qc.setQueriesData<WikiTreeDto>({ queryKey: ['wiki', 'tree'] }, (t) =>
          t
            ? {
                ...t,
                nodes: t.nodes.map((n) =>
                  n.id === id
                    ? { ...n, ...(patch.title !== undefined && { title: patch.title }) }
                    : n,
                ),
              }
            : t,
        );
        return { snapshots };
      },
      onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
      onSettled: () => refreshAll(qc),
    }),
    /** Optimistic: the tree reorders at once and rolls back if the server refuses. */
    moveNode: useMutation({
      mutationFn: (v: MoveVars) => wikiApi.moveNode(v.id, toBody(v)),
      onMutate: async (v) => {
        const key = wikiKeys.tree(v.spaceId);
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData<WikiTreeDto>(key);
        if (previous && !v.toSpaceId) {
          qc.setQueryData<WikiTreeDto>(key, {
            ...previous,
            nodes: applyMove(previous.nodes, v.id, v.placement),
          });
        }
        return { previous, key };
      },
      onError: (_e, _v, ctx) => {
        if (ctx?.previous) qc.setQueryData(ctx.key, ctx.previous);
      },
      onSettled: () => refreshAll(qc),
    }),
    deleteNode: useMutation({
      mutationFn: (id: string) => wikiApi.deleteNode(id),
      onSuccess: () => refreshAll(qc),
    }),
    restoreNode: useMutation({
      mutationFn: (id: string) => wikiApi.restoreNode(id),
      onSuccess: () => refreshAll(qc),
    }),
    purgeNode: useMutation({
      mutationFn: (id: string) => wikiApi.purgeNode(id),
      onSuccess: () => refreshAll(qc),
    }),
    favorite: useMutation({
      mutationFn: (v: { id: string; on: boolean }) => wikiApi.favorite(v.id, v.on),
      onSuccess: () => refreshAll(qc),
    }),
    setVisibility: useMutation({
      mutationFn: (v: {
        target: WikiTarget;
        visibility: WikiVisibilityName | null;
        workspaceRole: WikiWorkspaceRole;
      }) => wikiApi.setVisibility(v.target, v.visibility, v.workspaceRole),
      onSuccess: () => refreshAll(qc),
    }),
    setGrant: useMutation({
      mutationFn: (v: { target: WikiTarget; principalId: string; role: WikiRoleName }) =>
        wikiApi.setGrant(v.target, v.principalId, v.role),
      onSuccess: () => refreshAll(qc),
    }),
    removeGrant: useMutation({
      mutationFn: (v: { target: WikiTarget; principalId: string }) =>
        wikiApi.removeGrant(v.target, v.principalId),
      onSuccess: () => refreshAll(qc),
    }),
  };
}
