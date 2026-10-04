import { api, unwrap, type components } from '@/shared/api';

export type CustomField = components['schemas']['CustomField'];
export type CustomFieldInput = components['schemas']['CustomFieldInput'];
export type CustomFieldPatch = components['schemas']['CustomFieldPatch'];
export type CustomFieldKind = components['schemas']['CustomFieldKind'];
export type FieldOption = components['schemas']['FieldOption'];
export type CardFieldValue = components['schemas']['CardFieldValue'];
/** What a card holds for a field: text, url, date (YYYY-MM-DD), option id, number or boolean. */
export type FieldValue = string | number | boolean | null;

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });
const card = (cardId: string) => ({ params: { path: { cardId } } });

export const fieldsApi = {
  list: (workspaceId: string) =>
    unwrap(api.GET('/workspaces/{workspaceId}/custom-fields', ws(workspaceId))),
  create: (workspaceId: string, body: CustomFieldInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/custom-fields', { ...ws(workspaceId), body })),
  update: (fieldId: string, body: CustomFieldPatch) =>
    unwrap(api.PATCH('/custom-fields/{fieldId}', { params: { path: { fieldId } }, body })),
  remove: (fieldId: string) =>
    unwrap(api.DELETE('/custom-fields/{fieldId}', { params: { path: { fieldId } } })),
  reorder: (workspaceId: string, ids: string[]) =>
    unwrap(
      api.PUT('/workspaces/{workspaceId}/custom-fields/order', {
        ...ws(workspaceId),
        body: { ids },
      }),
    ),
  cardValues: (cardId: string) => unwrap(api.GET('/cards/{cardId}/field-values', card(cardId))),
  setValue: (cardId: string, fieldId: string, value: FieldValue) =>
    unwrap(
      api.PUT('/cards/{cardId}/field-values/{fieldId}', {
        params: { path: { cardId, fieldId } },
        body: { value },
      }),
    ),
  boardValues: (workspaceId: string, cardIds: string[]) =>
    unwrap(
      api.POST('/workspaces/{workspaceId}/custom-fields/values', {
        ...ws(workspaceId),
        body: { cardIds },
      }),
    ),
};
