/**
 * Runs the normalizer over the real captured ESPN responses.
 *
 * These double as the first contract check: if ESPN changes shape and the
 * fixtures are re-captured, the schema parse here fails with the field path.
 */

import { describe, expect, it } from 'vitest';
import {
  espnScoreboardSchema,
  espnStandingsSchema,
  espnTeamsSchema,
} from './espnSchemas';
import {
  conferenceIdFromName,
  normalizeEspnGame,
  normalizeEspnScoreboard,
  normalizeEspnStandings,
  normalizeEspnState,
  overallRecord,
  parseScore,
  sideOf,
  teamsById,
} from './normalizeEspn';
import { gameSchema, conferenceSchema, parseOrThrow } from '../schemas';

import finalFixture from './fixtures/scoreboard-final-2026-11-02.json';
import scheduledFixture from './fixtures/scoreboard-scheduled-2026-11-04.json';
import standingsFixture from './fixtures/standings-2026-11-03.json';
import teamsFixture from './fixtures/teams-2026-11-03.json';

const finals = espnScoreboardSchema.parse(finalFixture);
const scheduled = espnScoreboardSchema.parse(scheduledFixture);
const standings = espnStandingsSchema.parse(standingsFixture);
const teams = espnTeamsSchema.parse(teamsFixture);

describe('captured fixtures', () => {
  it('still satisfy the schemas they were captured against', () => {
    expect(() => espnScoreboardSchema.parse(finalFixture)).not.toThrow();
    expect(() => espnScoreboardSchema.parse(scheduledFixture)).not.toThrow();
    expect(() => espnStandingsSchema.parse(standingsFixture)).not.toThrow();
    expect(() => espnTeamsSchema.parse(teamsFixture)).not.toThrow();
  });
});

describe('parseScore', () => {
  it('reads the string ESPN actually sends', () => {
    expect(parseScore('117')).toBe(117);
    expect(parseScore('0')).toBe(0);
  });

  it('falls back to zero rather than NaN', () => {
    expect(parseScore(undefined)).toBe(0);
    expect(parseScore('')).toBe(0);
    expect(parseScore('TBD')).toBe(0);
  });
});

describe('sideOf', () => {
  it('finds the away team even though competitors are ordered home first', () => {
    const competition = finals.events[0]!.competitions[0]!;

    expect(competition.competitors[0]?.homeAway).toBe('home');
    expect(sideOf(competition.competitors, 'away')?.homeAway).toBe('away');
    expect(sideOf(competition.competitors, 'home')?.homeAway).toBe('home');
  });
});

describe('overallRecord', () => {
  it('picks the total record, not the home or road split', () => {
    const competitor = finals.events[0]!.competitions[0]!.competitors[0]!;
    const total = competitor.records?.find((r) => r.type === 'total')?.summary;

    expect(overallRecord(competitor)).toBe(total);
    expect(overallRecord(competitor)).toMatch(/^\d+-\d+$/);
  });
});

describe('normalizeEspnState', () => {
  it('maps pre to scheduled', () => {
    expect(normalizeEspnState('pre', 0, '0.0', '2026-11-04T00:00:00.000Z')).toEqual({
      status: 'scheduled',
      tipoff: '2026-11-04T00:00:00.000Z',
    });
  });

  it('flags overtime from the period number', () => {
    expect(normalizeEspnState('post', 4, '0.0', '')).toEqual({
      status: 'final',
      wentToOvertime: false,
    });
    expect(normalizeEspnState('post', 5, '0.0', '')).toEqual({
      status: 'final',
      wentToOvertime: true,
    });
  });

  it('maps in to live, labelling quarters and overtimes', () => {
    expect(normalizeEspnState('in', 3, '4:12', '')).toEqual({
      status: 'live',
      periodNumber: 3,
      periodLabel: 'Q3',
      clock: '4:12',
    });
    expect(normalizeEspnState('in', 5, '1:05', '')).toMatchObject({ periodLabel: 'OT1' });
  });

  it('blanks the stopped clock at a period break', () => {
    expect(normalizeEspnState('in', 2, '0.0', '')).toMatchObject({ clock: '' });
  });

  it('never reports period zero as live', () => {
    expect(normalizeEspnState('in', 0, '12:00', '')).toMatchObject({
      periodNumber: 1,
      periodLabel: 'Q1',
    });
  });
});

describe('normalizeEspnScoreboard — finished games', () => {
  const games = normalizeEspnScoreboard(finals);

  it('normalizes every captured event', () => {
    expect(games).toHaveLength(finals.events.length);
  });

  it('produces games that satisfy the domain schema', () => {
    for (const game of games) {
      expect(() => parseOrThrow(gameSchema, game, game.id)).not.toThrow();
    }
  });

  it('reports every captured game as final', () => {
    expect(games.every((game) => game.state.status === 'final')).toBe(true);
  });

  it('matches each score to the sum of that team s quarters', () => {
    for (const event of finals.events) {
      const competition = event.competitions[0]!;
      const game = normalizeEspnGame(event)!;

      for (const side of ['away', 'home'] as const) {
        const competitor = sideOf(competition.competitors, side)!;
        const fromPeriods = (competitor.linescores ?? []).reduce(
          (s, l) => s + l.value,
          0,
        );
        const shown = side === 'away' ? game.awayScore : game.homeScore;

        expect(shown, `${game.id} ${side}`).toBe(fromPeriods);
      }
    }
  });

  it('identifies the overtime game from its fifth period', () => {
    const overtime = games.filter(
      (game) => game.state.status === 'final' && game.state.wentToOvertime,
    );
    expect(overtime).toHaveLength(1);
  });

  it('prefixes team colors with a hash', () => {
    for (const game of games) {
      expect(game.away.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(game.home.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('normalizeEspnScoreboard — scheduled games', () => {
  const games = normalizeEspnScoreboard(scheduled);

  it('reports them as scheduled with no score', () => {
    for (const game of games) {
      expect(game.state.status).toBe('scheduled');
      expect(game.awayScore).toBe(0);
      expect(game.homeScore).toBe(0);
    }
  });

  it('survives linescores being absent rather than empty', () => {
    const competitor = scheduled.events[0]!.competitions[0]!.competitors[0]!;
    expect(competitor.linescores).toBeUndefined();
    expect(() => normalizeEspnScoreboard(scheduled)).not.toThrow();
  });

  it('produces games that satisfy the domain schema', () => {
    for (const game of games) {
      expect(() => parseOrThrow(gameSchema, game, game.id)).not.toThrow();
    }
  });
});

describe('conferenceIdFromName', () => {
  it('maps the names ESPN uses', () => {
    expect(conferenceIdFromName('Eastern Conference')).toBe('east');
    expect(conferenceIdFromName('Western Conference')).toBe('west');
    expect(conferenceIdFromName('Atlantic Division')).toBeNull();
  });
});

describe('normalizeEspnStandings', () => {
  const conferences = normalizeEspnStandings(standings, teamsById(teams));

  it('returns both conferences with fifteen teams each', () => {
    expect(conferences.map((c) => c.id).sort()).toEqual(['east', 'west']);
    for (const conference of conferences) {
      expect(conference.standings).toHaveLength(15);
    }
  });

  it('sorts into seed order, despite the feed arriving unsorted', () => {
    const firstEntry = standings.children[0]!.standings.entries[0]!;
    const firstSeed = firstEntry.stats.find((s) => s.name === 'playoffSeed')?.value;

    // The captured file genuinely leads with a low-seeded team.
    expect(firstSeed).toBeGreaterThan(1);

    for (const conference of conferences) {
      const ranks = conference.standings.map((row) => row.rank);
      expect(ranks).toEqual(ranks.map((_, i) => i + 1));
    }
  });

  it('orders by win percentage descending', () => {
    for (const conference of conferences) {
      const pcts = conference.standings.map((row) => row.winPercent);
      expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
    }
  });

  it('joins team colors in, since standings entries carry none', () => {
    const entryHasColor = standings.children[0]!.standings.entries[0]!.team.color;
    expect(entryHasColor).toBeUndefined();

    for (const conference of conferences) {
      for (const row of conference.standings) {
        expect(row.team.color, row.team.abbreviation).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('gives the conference leader zero games behind', () => {
    for (const conference of conferences) {
      expect(conference.standings[0]?.gamesBehind).toBe(0);
    }
  });

  it('produces conferences that satisfy the domain schema', () => {
    for (const conference of conferences) {
      expect(() =>
        parseOrThrow(conferenceSchema, conference, conference.id),
      ).not.toThrow();
    }
  });
});
