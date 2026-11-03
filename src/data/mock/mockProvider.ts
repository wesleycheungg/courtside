/**
 * The default provider: typed fixtures, no network.
 *
 * It runs fixtures through the same normalization the live provider will use, so
 * the normalizer is genuinely exercised rather than bypassed, and it carries one
 * simulated game that advances with the clock.
 */

import type { Clock } from '../clock';
import type {
  BoxScore,
  Conference,
  Game,
  GameDetail,
  PlayEvent,
  Player,
  PlayerStatLine,
  TeamStat,
} from '../types';
import type { DataProvider } from '../provider';
import { normalizeConference, normalizeGame, periodLabel } from './normalize';
import type { WireGame, WireStandings, WireTeam } from './wire';
import {
  SIM_GAME_ID,
  applyDetailSnapshot,
  applySnapshot,
  simSnapshotAt,
} from './simGame';

import teamsFixture from './fixtures/teams.json';
import gamesFixture from './fixtures/games.json';
import standingsFixture from './fixtures/standings.json';
import detailsFixture from './fixtures/details.json';
import playsFixture from './fixtures/plays.json';
import playersFixture from './fixtures/players.json';

interface DetailFixture {
  teamStats: TeamStat[];
  boxScore: BoxScore;
  topPerformerIds: string[];
}

const teams = teamsFixture as WireTeam[];
const teamsById: ReadonlyMap<string, WireTeam> = new Map(teams.map((t) => [t.teamId, t]));
const staticGames = gamesFixture as WireGame[];
const details = detailsFixture as Record<string, DetailFixture>;
const plays = playsFixture as Record<string, PlayEvent[]>;
const players = playersFixture as Player[];

/** The simulated game's static half; its score and state come from the clock. */
const SIM_WIRE: WireGame = {
  gameId: SIM_GAME_ID,
  league: 'nba',
  tipoffUtc: '23:15:00',
  statusCode: 'in',
  awayTeamId: 'nyk',
  homeTeamId: 'bos',
  awayRecord: { wins: 4, losses: 3 },
  homeRecord: { wins: 5, losses: 2 },
  linescores: [],
};

function toDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/** Mock data is not date-specific — every date returns the same slate, dated to
 *  the day being asked for. Real date filtering arrives with the feed in M2. */
function buildGames(date: string, clock: Clock): Game[] {
  const simGame = applySnapshot(
    normalizeGame(SIM_WIRE, date, teamsById),
    simSnapshotAt(clock.now()),
  );
  const rest = staticGames.map((wire) => normalizeGame(wire, date, teamsById));
  return [simGame, ...rest];
}

function findStatLine(
  detail: DetailFixture,
  playerId: string,
): PlayerStatLine | undefined {
  return [...detail.boxScore.away, ...detail.boxScore.home].find(
    (line) => line.playerId === playerId,
  );
}

function buildDetail(game: Game, clock: Clock): GameDetail {
  const fixture = details[game.id];
  if (!fixture) throw new Error(`No detail fixture for game ${game.id}`);

  const topPerformers = fixture.topPerformerIds
    .map((id) => findStatLine(fixture, id))
    .filter((line): line is PlayerStatLine => line !== undefined);

  const base: GameDetail = {
    ...game,
    periods: [],
    teamStats: fixture.teamStats,
    boxScore: fixture.boxScore,
    topPerformers,
  };

  if (game.id === SIM_GAME_ID) {
    return applyDetailSnapshot(base, simSnapshotAt(clock.now()));
  }

  const wire = staticGames.find((candidate) => candidate.gameId === game.id);
  return {
    ...base,
    periods: (wire?.linescores ?? []).map((line) => ({
      number: line.period,
      label: periodLabel(line.period),
      awayScore: line.away,
      homeScore: line.home,
    })),
  };
}

export interface MockProviderOptions {
  clock: Clock;
}

export function createMockProvider({ clock }: MockProviderOptions): DataProvider {
  return {
    name: 'mock',

    async getGames(date: string): Promise<Game[]> {
      return buildGames(date, clock);
    },

    async getGame(id: string): Promise<GameDetail> {
      const game = buildGames(toDateKey(clock.now()), clock).find(
        (candidate) => candidate.id === id,
      );
      if (!game) throw new Error(`Unknown game: ${id}`);
      return buildDetail(game, clock);
    },

    async getStandings(): Promise<Conference[]> {
      const wire = standingsFixture as WireStandings;
      return [
        normalizeConference('east', 'Eastern Conference', wire.east, teamsById),
        normalizeConference('west', 'Western Conference', wire.west, teamsById),
      ];
    },

    async getPlayer(id: string): Promise<Player> {
      const player = players.find((candidate) => candidate.id === id);
      if (!player) throw new Error(`Unknown player: ${id}`);
      return player;
    },

    async getPlayByPlay(id: string): Promise<PlayEvent[]> {
      return plays[id] ?? [];
    },
  };
}
