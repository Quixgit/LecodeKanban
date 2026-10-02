import { api, unwrap, type components } from '@/shared/api';

export type Board = components['schemas']['Board'];
export type BoardColumn = components['schemas']['BoardColumn'];
export type ColumnInput = components['schemas']['ColumnInput'];
export type ColumnPatch = components['schemas']['ColumnPatch'];
export type Neighbours = components['schemas']['Neighbours'];
export type SavedView = components['schemas']['SavedView'];
export type SavedViewInput = components['schemas']['SavedViewInput'];

const column = (columnId: string) => ({ params: { path: { columnId } } });

export const kanbanApi = {
  board: (projectId: string) =>
    unwrap(api.GET('/projects/{projectId}/board', { params: { path: { projectId } } })),
  createColumn: (projectId: string, body: ColumnInput) =>
    unwrap(
      api.POST('/projects/{projectId}/board/columns', { params: { path: { projectId } }, body }),
    ),
  updateColumn: (columnId: string, body: ColumnPatch) =>
    unwrap(api.PATCH('/columns/{columnId}', { ...column(columnId), body })),
  moveColumn: (columnId: string, body: Neighbours) =>
    unwrap(api.POST('/columns/{columnId}/move', { ...column(columnId), body })),
  deleteColumn: (columnId: string) => unwrap(api.DELETE('/columns/{columnId}', column(columnId))),
  views: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/views', { params: { path: { workspaceId } } })),
  createView: (workspaceId: string, body: SavedViewInput) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/views', { params: { path: { workspaceId } }, body }),
    ),
  deleteView: (viewId: string) =>
    unwrap(api.DELETE('/views/{viewId}', { params: { path: { viewId } } })),
};
