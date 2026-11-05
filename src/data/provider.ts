/**
 * The seam between the app and wherever data comes from.
 *
 * Every provider returns domain types. A component cannot tell which provider
 * it is talking to, which is what makes the mock a genuine stand-in for live
 * data rather than a separate code path.
 */

import type {
  Conference,
  Game,
  GameDetail,
  PlayEvent,
  Player,
  RosterEntry,
} from './types';
import { type Clock, resolveClock, systemClock } from './clock';
import { createMockProvider } from './mock/mockProvider';
import { createEspnProvider } from './espn/espnProvider';

export interface DataProvider {
  readonly name: string;
  /** @param date calendar date as YYYY-MM-DD */
  getGames(date: string): Promise<Game[]>;
  getGame(id: string): Promise<GameDetail>;
  getStandings(): Promise<Conference[]>;
  getPlayer(id: string): Promise<Player>;
  /**
   * The roster and season averages for one team. Only the box score before
   * tipoff asks for this, and only for the team on show.
   *
   * @param teamId the provider's own team id, as carried on `TeamRef.id` —
   * `cle` under mock, `21` under ESPN. The two namespaces never mix.
   */
  getTeamRoster(teamId: string): Promise<RosterEntry[]>;
  getPlayByPlay(id: string): Promise<PlayEvent[]>;
}

export interface ProviderOptions {
  clock?: Clock;
  /** Defaults to the browser's current query string. */
  search?: string;
}

/**
 * Picks the provider from VITE_DATA_PROVIDER, defaulting to mock so a fresh
 * clone and every CI run work with no network and no configuration.
 */
export function getProvider(options: ProviderOptions = {}): DataProvider {
  const search =
    options.search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const clock = options.clock ?? resolveClock(search, systemClock);

  switch (import.meta.env.VITE_DATA_PROVIDER) {
    case 'espn':
      return createEspnProvider();
    default:
      return createMockProvider({ clock });
  }
}
