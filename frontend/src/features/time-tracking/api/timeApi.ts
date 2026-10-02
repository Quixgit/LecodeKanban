import { api, unwrap, type components } from '@/shared/api';

export type TimeEntry = components['schemas']['TimeEntry'];
export type TimeSummary = components['schemas']['TimeSummary'];
export type TimeLogInput = components['schemas']['TimeLogInput'];

const card = (cardId: string) => ({ params: { path: { cardId } } });
const entry = (entryId: string) => ({ params: { path: { entryId } } });

export const timeApi = {
  list: (cardId: string) => unwrap(api.GET('/cards/{cardId}/time', card(cardId))),
  running: () => unwrap(api.GET('/timer')),
  start: (cardId: string) => unwrap(api.POST('/cards/{cardId}/timer', card(cardId))),
  stop: (entryId: string) => unwrap(api.POST('/time-entries/{entryId}/stop', entry(entryId))),
  log: (cardId: string, body: TimeLogInput) =>
    unwrap(api.POST('/cards/{cardId}/time', { ...card(cardId), body })),
  remove: (entryId: string) => unwrap(api.DELETE('/time-entries/{entryId}', entry(entryId))),
};
