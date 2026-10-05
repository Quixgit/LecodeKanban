import { api, unwrap, type components } from '@/shared/api';

export type PerformanceReport = components['schemas']['PerformanceReport'];
export type PerformanceDay = components['schemas']['PerformanceDay'];
export type PerformanceBucket = components['schemas']['PerformanceBucket'];
export type PerformanceAged = components['schemas']['PerformanceAged'];
export type PerformancePerson = components['schemas']['PerformancePerson'];
export type PerformanceProject = components['schemas']['PerformanceProject'];
export type DurationStat = components['schemas']['DurationStat'];

export interface PerformanceQuery {
  days: 7 | 30 | 90;
  projectId?: string;
  assigneeId?: string;
  labelId?: string;
}

export const performanceApi = {
  report: (workspaceId: string, query: PerformanceQuery) =>
    unwrap(
      api.GET('/workspaces/{workspaceId}/analytics/performance', {
        params: { path: { workspaceId }, query },
      }),
    ),
};
