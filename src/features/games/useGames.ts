import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useDataProvider } from '../../data/ProviderContext';
import type { Game } from '../../data/types';

/** How often a live slate refetches. */
export const LIVE_POLL_MS = 15_000;

export function hasLiveGame(games: Game[] | undefined): boolean {
  return games?.some((game) => game.state.status === 'live') ?? false;
}

/** Which provider is serving this session — drives the footer attribution. */
export function useProviderName(): string {
  return useDataProvider().name;
}

/**
 * The slate for one calendar date.
 *
 * Polls every 15s while any game is live and stops once none are, so a day of
 * finished games settles down instead of refetching forever.
 */
export function useGames(date: string): UseQueryResult<Game[], Error> {
  const provider = useDataProvider();

  return useQuery({
    queryKey: ['games', date],
    queryFn: () => provider.getGames(date),
    refetchInterval: (query) => (hasLiveGame(query.state.data) ? LIVE_POLL_MS : false),
  });
}
