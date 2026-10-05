import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { performanceApi, type PerformanceQuery } from '../api/performanceApi';

/** Under the `cards` prefix, so a realtime card change refreshes the report too. */
export const performanceKeys = {
  report: (ws: string, q: PerformanceQuery) => ['cards', ws, 'performance', q] as const,
};

export function usePerformance(workspaceId: string | undefined, query: PerformanceQuery) {
  return useQuery({
    queryKey: performanceKeys.report(workspaceId ?? '', query),
    queryFn: () => performanceApi.report(workspaceId!, query),
    enabled: !!workspaceId,
    placeholderData: keepPreviousData,
  });
}
