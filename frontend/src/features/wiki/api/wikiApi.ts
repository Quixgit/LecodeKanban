import { api, unwrap, type components } from '@/shared/api';

export type WikiSpace = components['schemas']['WikiSpace'];
export type WikiSpaceInput = components['schemas']['WikiSpaceInput'];
export type WikiSpacePatch = components['schemas']['WikiSpacePatch'];
export type WikiNodeDto = components['schemas']['WikiNode'];
export type WikiTreeDto = components['schemas']['WikiTree'];
export type WikiNodeInput = components['schemas']['WikiNodeInput'];
export type WikiNodePatch = components['schemas']['WikiNodePatch'];
export type WikiMoveInput = components['schemas']['WikiMoveInput'];
export type WikiTrashItem = components['schemas']['WikiTrashItem'];
export type WikiAccessSummary = components['schemas']['WikiAccessSummary'];
export type WikiGrant = components['schemas']['WikiGrant'];
export type WikiAuditPage = components['schemas']['WikiAuditPage'];
export type WikiRoleName = components['schemas']['WikiRole'];
export type WikiVisibilityName = components['schemas']['WikiVisibility'];
export type WikiWorkspaceRole = components['schemas']['WikiWorkspaceRole'];

/** A space or a node: the element a sharing call addresses. */
export type WikiTarget =
  { spaceId: string; nodeId?: undefined } | { nodeId: string; spaceId?: string };

const workspace = (workspaceId: string) => ({ params: { path: { workspaceId } } });
const space = (spaceId: string) => ({ path: { spaceId } });
const node = (nodeId: string) => ({ path: { nodeId } });

export const wikiApi = {
  spaces: (ws: string) => unwrap(api.GET('/workspaces/{workspaceId}/wiki/spaces', workspace(ws))),
  createSpace: (ws: string, body: WikiSpaceInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/wiki/spaces', { ...workspace(ws), body })),
  updateSpace: (id: string, body: WikiSpacePatch) =>
    unwrap(api.PATCH('/wiki/spaces/{spaceId}', { params: space(id), body })),
  deleteSpace: (id: string) => unwrap(api.DELETE('/wiki/spaces/{spaceId}', { params: space(id) })),
  tree: (id: string) => unwrap(api.GET('/wiki/spaces/{spaceId}/tree', { params: space(id) })),

  node: (id: string) => unwrap(api.GET('/wiki/nodes/{nodeId}', { params: node(id) })),
  createNode: (spaceId: string, body: WikiNodeInput) =>
    unwrap(api.POST('/wiki/spaces/{spaceId}/nodes', { params: space(spaceId), body })),
  updateNode: (id: string, body: WikiNodePatch) =>
    unwrap(api.PATCH('/wiki/nodes/{nodeId}', { params: node(id), body })),
  moveNode: (id: string, body: WikiMoveInput) =>
    unwrap(api.POST('/wiki/nodes/{nodeId}/move', { params: node(id), body })),
  deleteNode: (id: string) => unwrap(api.DELETE('/wiki/nodes/{nodeId}', { params: node(id) })),
  restoreNode: (id: string) =>
    unwrap(api.POST('/wiki/nodes/{nodeId}/restore', { params: node(id) })),
  purgeNode: (id: string) => unwrap(api.DELETE('/wiki/nodes/{nodeId}/purge', { params: node(id) })),
  favorite: (id: string, on: boolean) =>
    unwrap(
      on
        ? api.PUT('/wiki/nodes/{nodeId}/favorite', { params: node(id) })
        : api.DELETE('/wiki/nodes/{nodeId}/favorite', { params: node(id) }),
    ),

  favorites: (ws: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/wiki/favorites', workspace(ws))),
  recent: (ws: string) => unwrap(api.GET('/workspaces/{workspaceId}/wiki/recent', workspace(ws))),
  shared: (ws: string) => unwrap(api.GET('/workspaces/{workspaceId}/wiki/shared', workspace(ws))),
  mine: (ws: string) => unwrap(api.GET('/workspaces/{workspaceId}/wiki/private', workspace(ws))),
  trash: (ws: string) => unwrap(api.GET('/workspaces/{workspaceId}/wiki/trash', workspace(ws))),

  access: (t: WikiTarget) =>
    unwrap(
      t.nodeId
        ? api.GET('/wiki/nodes/{nodeId}/access', { params: node(t.nodeId) })
        : api.GET('/wiki/spaces/{spaceId}/access', { params: space(t.spaceId!) }),
    ),
  setVisibility: (
    t: WikiTarget,
    visibility: WikiVisibilityName | null,
    workspaceRole: WikiWorkspaceRole,
  ) => {
    const body = { visibility, workspaceRole };
    return unwrap(
      t.nodeId
        ? api.PUT('/wiki/nodes/{nodeId}/visibility', { params: node(t.nodeId), body })
        : api.PUT('/wiki/spaces/{spaceId}/visibility', { params: space(t.spaceId!), body }),
    );
  },
  setGrant: (t: WikiTarget, principalId: string, role: WikiRoleName) => {
    const body = { role };
    return unwrap(
      t.nodeId
        ? api.PUT('/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}', {
            params: { path: { nodeId: t.nodeId, kind: 'user', principalId } },
            body,
          })
        : api.PUT('/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}', {
            params: { path: { spaceId: t.spaceId!, kind: 'user', principalId } },
            body,
          }),
    );
  },
  removeGrant: (t: WikiTarget, principalId: string) =>
    unwrap(
      t.nodeId
        ? api.DELETE('/wiki/nodes/{nodeId}/permissions/{kind}/{principalId}', {
            params: { path: { nodeId: t.nodeId, kind: 'user', principalId } },
          })
        : api.DELETE('/wiki/spaces/{spaceId}/permissions/{kind}/{principalId}', {
            params: { path: { spaceId: t.spaceId!, kind: 'user', principalId } },
          }),
    ),
};
