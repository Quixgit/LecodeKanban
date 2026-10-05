import { api, unwrap, type components } from '@/shared/api';

export type TimeEntry = components['schemas']['TimeEntry'];
export type TimeSummary = components['schemas']['TimeSummary'];
export type TimeLogInput = components['schemas']['TimeLogInput'];
export type TimeEntryPatch = components['schemas']['TimeEntryPatch'];
export type Timesheet = components['schemas']['Timesheet'];
export type TimesheetEntry = components['schemas']['TimesheetEntry'];

export interface TimesheetQuery {
  from: string;
  to: string;
  userId?: string;
  projectId?: string;
}

const card = (cardId: string) => ({ params: { path: { cardId } } });
const entry = (entryId: string) => ({ params: { path: { entryId } } });

export const timeApi = {
  list: (cardId: string) => unwrap(api.GET('/cards/{cardId}/time', card(cardId))),
  running: () => unwrap(api.GET('/timer')),
  start: (cardId: string) => unwrap(api.POST('/cards/{cardId}/timer', card(cardId))),
  stop: (entryId: string) => unwrap(api.POST('/time-entries/{entryId}/stop', entry(entryId))),
  log: (cardId: string, body: TimeLogInput) =>
    unwrap(api.POST('/cards/{cardId}/time', { ...card(cardId), body })),
  update: (entryId: string, body: TimeEntryPatch) =>
    unwrap(api.PATCH('/time-entries/{entryId}', { ...entry(entryId), body })),
  setEstimate: (cardId: string, seconds: number | null) =>
    unwrap(api.PUT('/cards/{cardId}/time-estimate', { ...card(cardId), body: { seconds } })),
  timesheet: (workspaceId: string, query: TimesheetQuery) =>
    unwrap(api.GET('/workspaces/{workspaceId}/time', { params: { path: { workspaceId }, query } })),
  remove: (entryId: string) => unwrap(api.DELETE('/time-entries/{entryId}', entry(entryId))),
};
