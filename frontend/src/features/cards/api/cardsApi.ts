import { api, unwrap, type components, type paths } from '@/shared/api';

export type Card = components['schemas']['Card'];
export type CardInput = components['schemas']['CardInput'];
export type CardPatch = components['schemas']['CardPatch'];
export type CardMove = components['schemas']['CardMove'];
export type TaskStatus = components['schemas']['TaskStatus'];
export type Priority = components['schemas']['Priority'];
export type StatusCounts = components['schemas']['StatusCounts'];
export type DashboardStats = components['schemas']['DashboardStats'];
export type BulkCardAction = components['schemas']['BulkCardAction'];
export type Label = components['schemas']['Label'];
export type LabelInput = components['schemas']['LabelInput'];
export type LabelPatch = components['schemas']['LabelPatch'];
export type CardBoard = components['schemas']['CardBoard'];
export type TrashItem = components['schemas']['TrashItem'];
export type BoardQuery = NonNullable<
  paths['/workspaces/{workspaceId}/cards/board']['get']['parameters']['query']
>;
export type CardQuery = NonNullable<
  paths['/workspaces/{workspaceId}/cards']['get']['parameters']['query']
>;
export type CardCountQuery = NonNullable<
  paths['/workspaces/{workspaceId}/cards/summary']['get']['parameters']['query']
>;

const ws = (workspaceId: string) => ({ path: { workspaceId } });
const card = (cardId: string) => ({ params: { path: { cardId } } });

export const cardsApi = {
  list: (workspaceId: string, query: CardQuery) =>
    unwrap(api.GET('/workspaces/{workspaceId}/cards', { params: { ...ws(workspaceId), query } })),
  counts: (workspaceId: string, query: CardCountQuery) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/cards/summary', { params: { ...ws(workspaceId), query } }),
    ),
  stats: (workspaceId: string, days: number) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/cards/stats', {
        params: { ...ws(workspaceId), query: { days } },
      }),
    ),
  get: (cardId: string) => unwrap(api.GET('/cards/{cardId}', card(cardId))),
  create: (workspaceId: string, body: CardInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/cards', { params: ws(workspaceId), body })),
  update: (cardId: string, body: CardPatch) =>
    unwrap(api.PATCH('/cards/{cardId}', { ...card(cardId), body })),
  move: (cardId: string, body: CardMove) =>
    unwrap(api.POST('/cards/{cardId}/move', { ...card(cardId), body })),
  trash: (workspaceId: string, projectId?: string) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/cards/trash', {
        params: { ...ws(workspaceId), query: { projectId } },
      }),
    ),
  restore: (cardId: string) => unwrap(api.POST('/cards/{cardId}/restore', card(cardId))),
  remove: (cardId: string) => unwrap(api.DELETE('/cards/{cardId}', card(cardId))),
  bulk: (workspaceId: string, body: BulkCardAction) =>
    unwrap(api.POST('/workspaces/{workspaceId}/cards/bulk', { params: ws(workspaceId), body })),
  board: (workspaceId: string, query: BoardQuery) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/cards/board', { params: { ...ws(workspaceId), query } }),
    ),
  labels: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/labels', { params: ws(workspaceId) })),
  createLabel: (workspaceId: string, body: LabelInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/labels', { params: ws(workspaceId), body })),
  updateLabel: (labelId: string, body: LabelPatch) =>
    unwrap(api.PATCH('/labels/{labelId}', { params: { path: { labelId } }, body })),
  deleteLabel: (labelId: string) =>
    unwrap(api.DELETE('/labels/{labelId}', { params: { path: { labelId } } })),
};
