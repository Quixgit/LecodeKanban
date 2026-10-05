import { api, unwrap, type components } from '@/shared/api';

export type TaskTemplate = components['schemas']['TaskTemplate'];
export type TaskTemplateInput = components['schemas']['TaskTemplateInput'];
export type UseTemplateRequest = components['schemas']['UseTemplateRequest'];
export type RecurringTask = components['schemas']['RecurringTask'];
export type RecurringTaskInput = components['schemas']['RecurringTaskInput'];

const ws = (workspaceId: string) => ({ params: { path: { workspaceId } } });
const tpl = (templateId: string) => ({ params: { path: { templateId } } });
const rec = (recurringId: string) => ({ params: { path: { recurringId } } });

export const templatesApi = {
  list: (w: string) => unwrap(api.GET('/workspaces/{workspaceId}/templates', ws(w))),
  create: (w: string, body: TaskTemplateInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/templates', { ...ws(w), body })),
  update: (id: string, body: TaskTemplateInput) =>
    unwrap(api.PUT('/templates/{templateId}', { ...tpl(id), body })),
  remove: (id: string) => unwrap(api.DELETE('/templates/{templateId}', tpl(id))),
  use: (id: string, body: UseTemplateRequest) =>
    unwrap(api.POST('/templates/{templateId}/use', { ...tpl(id), body })),
  recurring: (w: string) => unwrap(api.GET('/workspaces/{workspaceId}/recurring', ws(w))),
  createRecurring: (w: string, body: RecurringTaskInput) =>
    unwrap(api.POST('/workspaces/{workspaceId}/recurring', { ...ws(w), body })),
  updateRecurring: (id: string, body: RecurringTaskInput) =>
    unwrap(api.PUT('/recurring/{recurringId}', { ...rec(id), body })),
  removeRecurring: (id: string) => unwrap(api.DELETE('/recurring/{recurringId}', rec(id))),
};
