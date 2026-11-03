import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchHealth, type HealthReport } from '../../data/health';

/** Slower than the live-score poll: nothing here changes second to second. */
export const HEALTH_POLL_MS = 30_000;

export function useHealth(): UseQueryResult<HealthReport, Error> {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => fetchHealth(),
    refetchInterval: HEALTH_POLL_MS,
    // A diagnostic page showing a cached answer would be misleading.
    staleTime: 0,
  });
}
