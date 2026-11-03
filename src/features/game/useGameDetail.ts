import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getProvider } from '../../data/provider';
import type { GameDetail, PlayEvent } from '../../data/types';
import { LIVE_POLL_MS } from '../games/useGames';

/** A live detail view refreshes on the same cadence as the feed. */
function pollWhileLive(detail: GameDetail | undefined): number | false {
  return detail?.state.status === 'live' ? LIVE_POLL_MS : false;
}

export function useGameDetail(id: string): UseQueryResult<GameDetail, Error> {
  const provider = useMemo(() => getProvider(), []);

  return useQuery({
    queryKey: ['game', id],
    queryFn: () => provider.getGame(id),
    refetchInterval: (query) => pollWhileLive(query.state.data),
  });
}

export function usePlayByPlay(
  id: string,
  options: { enabled: boolean; isLive: boolean },
): UseQueryResult<PlayEvent[], Error> {
  const provider = useMemo(() => getProvider(), []);

  return useQuery({
    queryKey: ['plays', id],
    queryFn: () => provider.getPlayByPlay(id),
    // Only fetched once the Plays tab is open — it is the largest payload and
    // most visits never open it.
    enabled: options.enabled,
    refetchInterval: options.isLive ? LIVE_POLL_MS : false,
  });
}
