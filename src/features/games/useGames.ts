import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getProvider } from '../../data/provider';
import type { Game } from '../../data/types';

/** How often a live slate refetches. */
export const LIVE_POLL_MS = 15_000;

export function hasLiveGame(games: Game[] | undefined): boolean {
  return games?.some((game) => game.state.status === 'live') ?? false;
}

/**
 * The slate for one calendar date.
 *
 * Polls every 15s while any game is live and stops once none are, so a day of
 * finished games settles down instead of refetching forever.
 */
export function useGames(date: string): UseQueryResult<Game[], Error> {
  // The provider reads the sim clock off the URL, so build it once per render
  // pass rather than per query.
  const provider = useMemo(() => getProvider(), []);

  return useQuery({
    queryKey: ['games', date],
    queryFn: () => provider.getGames(date),
    refetchInterval: (query) => (hasLiveGame(query.state.data) ? LIVE_POLL_MS : false),
  });
}
