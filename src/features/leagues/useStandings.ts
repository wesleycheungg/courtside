import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getProvider } from '../../data/provider';
import type { Conference } from '../../data/types';

export function useStandings(): UseQueryResult<Conference[], Error> {
  const provider = useMemo(() => getProvider(), []);

  return useQuery({
    queryKey: ['standings'],
    queryFn: () => provider.getStandings(),
    // Standings only move when a game ends, so no polling.
    staleTime: 60_000,
  });
}
