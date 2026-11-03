import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getProvider } from '../../data/provider';
import type { Player } from '../../data/types';

export function usePlayer(id: string): UseQueryResult<Player, Error> {
  const provider = useMemo(() => getProvider(), []);

  return useQuery({
    queryKey: ['player', id],
    queryFn: () => provider.getPlayer(id),
    staleTime: 60_000,
  });
}
