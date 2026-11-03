import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useDataProvider } from '../../data/ProviderContext';
import type { Player } from '../../data/types';

export function usePlayer(id: string): UseQueryResult<Player, Error> {
  const provider = useDataProvider();

  return useQuery({
    queryKey: ['player', id],
    queryFn: () => provider.getPlayer(id),
    staleTime: 60_000,
  });
}
