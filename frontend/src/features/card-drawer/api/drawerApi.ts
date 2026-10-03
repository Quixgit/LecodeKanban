import { api, apiBaseUrl, unwrap, type components } from '@/shared/api';

export type ChecklistItem = components['schemas']['ChecklistItem'];
export type ChecklistItemPatch = components['schemas']['ChecklistItemPatch'];
export type Attachment = components['schemas']['Attachment'];
export type ActivityEntry = components['schemas']['ActivityEntry'];
export type ActivityPage = components['schemas']['ActivityPage'];

const card = (cardId: string) => ({ params: { path: { cardId } } });

/** URL of an attachment's bytes (authorised by the session cookie). */
export function attachmentUrl(id: string, inline = false) {
  return `${apiBaseUrl.replace(/\/$/, '')}/attachments/${id}/content${inline ? '?inline=true' : ''}`;
}

export const drawerApi = {
  columns: (projectId: string) =>
    unwrap(api.GET('/projects/{projectId}/board', { params: { path: { projectId } } })),
  checklist: (cardId: string) => unwrap(api.GET('/cards/{cardId}/checklist', card(cardId))),
  addItem: (cardId: string, text: string) =>
    unwrap(api.POST('/cards/{cardId}/checklist', { ...card(cardId), body: { text } })),
  updateItem: (itemId: string, body: ChecklistItemPatch) =>
    unwrap(api.PATCH('/checklist-items/{itemId}', { params: { path: { itemId } }, body })),
  deleteItem: (itemId: string) =>
    unwrap(api.DELETE('/checklist-items/{itemId}', { params: { path: { itemId } } })),
  attachments: (cardId: string) => unwrap(api.GET('/cards/{cardId}/attachments', card(cardId))),
  upload: (cardId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return unwrap(
      api.POST('/cards/{cardId}/attachments', {
        ...card(cardId),
        // The schema describes the multipart part; the browser sets the boundary header.
        body: { file: file as unknown as string },
        bodySerializer: () => form,
      }),
    );
  },
  deleteAttachment: (attachmentId: string) =>
    unwrap(api.DELETE('/attachments/{attachmentId}', { params: { path: { attachmentId } } })),
  activity: (cardId: string, before?: number) =>
    unwrap(
      api.GET('/cards/{cardId}/activity', {
        params: { path: { cardId }, query: { before, limit: 30 } },
      }),
    ),
};
