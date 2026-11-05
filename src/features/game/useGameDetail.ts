import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useDataProvider } from '../../data/ProviderContext';
import type { GameDetail, PlayEvent, RosterEntry } from '../../data/types';
import { LIVE_POLL_MS } from '../games/useGames';

/** A roster does not move during a game, let alone before one. */
const ROSTER_STALE_MS = 5 * 60_000;

/** A live detail view refreshes on the same cadence as the feed. */
function pollWhileLive(detail: GameDetail | undefined): number | false {
  return detail?.state.status === 'live' ? LIVE_POLL_MS : false;
}

export function useGameDetail(id: string): UseQueryResult<GameDetail, Error> {
  const provider = useDataProvider();

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
  const provider = useDataProvider();

  return useQuery({
    queryKey: ['plays', id],
    queryFn: () => provider.getPlayByPlay(id),
    // Only fetched once the Plays tab is open — it is the largest payload and
    // most visits never open it.
    enabled: options.enabled,
    refetchInterval: options.isLive ? LIVE_POLL_MS : false,
  });
}

export function useTeamRoster(
  teamId: string,
  options: { enabled: boolean },
): UseQueryResult<RosterEntry[], Error> {
  const provider = useDataProvider();

  return useQuery({
    queryKey: ['roster', teamId],
    queryFn: () => provider.getTeamRoster(teamId),
    // Only the pre-game box score asks for this, and only for the team on
    // show. Keyed by team, so flipping the chips back is instant.
    enabled: options.enabled,
    staleTime: ROSTER_STALE_MS,
  });
}
