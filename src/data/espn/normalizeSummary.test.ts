import { describe, expect, it } from 'vitest';
import { espnSummarySchema } from './espnSchemas';
import {
  normalizeEspnPlays,
  normalizeEspnSummary,
  normalizePlayerGroup,
  normalizeTeamForm,
  pickTopPerformers,
  shareOf,
  statToNumber,
} from './normalizeSummary';
import { gameDetailSchema, parseOrThrow } from '../schemas';
import summaryFixture from './fixtures/summary-final-401909907.json';
import pregameFixture from './fixtures/summary-pregame-401909289.json';
import { aBoxScore, aStatLine } from '../../test/builders';

const summary = espnSummarySchema.parse(summaryFixture);
const pregameSummary = espnSummarySchema.parse(pregameFixture);

describe('statToNumber', () => {
  it('takes the makes from a made-attempted pair', () => {
    expect(statToNumber('12-31')).toBe(12);
  });

  it('reads a plain number and a percentage alike', () => {
    expect(statToNumber('43')).toBe(43);
    expect(statToNumber('45.6%')).toBe(45.6);
  });

  it('falls back to zero rather than NaN', () => {
    expect(statToNumber('')).toBe(0);
    expect(statToNumber('—')).toBe(0);
  });
});

describe('shareOf', () => {
  it('splits proportionally', () => {
    expect(shareOf(40, 60)).toBe(0.4);
    expect(shareOf(50, 50)).toBe(0.5);
  });

  it('halves a 0-0 pair instead of dividing by zero', () => {
    expect(shareOf(0, 0)).toBe(0.5);
  });
});

describe('pickTopPerformers', () => {
  it('takes the highest scorer from each side', () => {
    const box = aBoxScore({
      home: [
        aStatLine({ playerId: 'a', points: 12 }),
        aStatLine({ playerId: 'b', points: 28 }),
      ],
      away: [aStatLine({ playerId: 'c', points: 31 })],
    });

    expect(pickTopPerformers(box).map((p) => p.playerId)).toEqual(['b', 'c']);
  });

  it('omits a side with no players rather than returning a hole', () => {
    const box = aBoxScore({ away: [] });
    expect(pickTopPerformers(box)).toHaveLength(1);
  });
});

describe('normalizePlayerGroup', () => {
  it('returns nothing for a missing group', () => {
    expect(normalizePlayerGroup(undefined)).toEqual([]);
  });

  it('reads columns by label, not by position', () => {
    const group = {
      team: { id: '1', abbreviation: 'BOS', displayName: 'Boston Celtics' },
      statistics: [
        {
          // Deliberately not the order ESPN currently sends.
          labels: ['PTS', 'MIN', '+/-', 'AST', 'REB', 'FG'],
          athletes: [
            {
              athlete: { id: '9', displayName: 'Test Player', jersey: '13' },
              stats: ['28', '30', '-4', '5', '9', '10-19'],
            },
          ],
        },
      ],
    };

    expect(normalizePlayerGroup(group)).toEqual([
      {
        playerId: '9',
        name: 'Test Player',
        position: '—',
        jerseyNumber: '13',
        minutes: 30,
        points: 28,
        rebounds: 9,
        assists: 5,
        fieldGoalsMade: 10,
        fieldGoalsAttempted: 19,
        plusMinus: -4,
      },
    ]);
  });

  it('drops players who did not appear', () => {
    const group = {
      team: { id: '1', abbreviation: 'BOS', displayName: 'Boston Celtics' },
      statistics: [
        {
          labels: ['MIN', 'PTS'],
          athletes: [
            { athlete: { id: '1', displayName: 'Played' }, stats: ['30', '28'] },
            {
              athlete: { id: '2', displayName: 'Did not play' },
              stats: ['--', '--'],
              didNotPlay: true,
            },
          ],
        },
      ],
    };

    expect(normalizePlayerGroup(group).map((l) => l.playerId)).toEqual(['1']);
  });

  it('empties a jersey the summary omits or nulls, rather than dropping the row', () => {
    const group = {
      team: { id: '1', abbreviation: 'BOS', displayName: 'Boston Celtics' },
      statistics: [
        {
          labels: ['MIN', 'PTS'],
          athletes: [
            { athlete: { id: '1', displayName: 'No jersey key' }, stats: ['30', '28'] },
            {
              athlete: { id: '2', displayName: 'Null jersey', jersey: null },
              stats: ['12', '4'],
            },
          ],
        },
      ],
    };

    expect(normalizePlayerGroup(group).map((l) => l.jerseyNumber)).toEqual(['', '']);
  });
});

describe('normalizeEspnSummary over the captured response', () => {
  const detail = normalizeEspnSummary(summary);

  it('satisfies the domain schema', () => {
    expect(() => parseOrThrow(gameDetailSchema, detail, detail.id)).not.toThrow();
  });

  it('matches each total to the sum of that team s quarters', () => {
    const away = detail.periods.reduce((sum, p) => sum + p.awayScore, 0);
    const home = detail.periods.reduce((sum, p) => sum + p.homeScore, 0);

    expect(away).toBe(detail.awayScore);
    expect(home).toBe(detail.homeScore);
  });

  it('reads line scores the summary sends as displayValue strings', () => {
    // The summary header omits `value` and `period` entirely — the whole
    // reason lineScoreValue exists.
    const raw = summary.header.competitions[0]?.competitors[0]?.linescores?.[0];
    expect(raw?.value).toBeUndefined();
    expect(raw?.displayValue).toBeDefined();

    expect(detail.periods.every((p) => Number.isFinite(p.awayScore))).toBe(true);
  });

  it('reads the record from the summary s singular `record` key', () => {
    expect(detail.away.record).toMatch(/^\d+-\d+$/);
    expect(detail.home.record).toMatch(/^\d+-\d+$/);
  });

  it('numbers periods from one even though the summary omits the field', () => {
    expect(detail.periods.map((p) => p.number)).toEqual([1, 2, 3, 4]);
    expect(detail.periods.map((p) => p.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
  });

  it('builds a box score for both sides', () => {
    expect(detail.boxScore.away.length).toBeGreaterThan(0);
    expect(detail.boxScore.home.length).toBeGreaterThan(0);
  });

  it('carries a jersey number for every player who appeared', () => {
    const lines = [...detail.boxScore.away, ...detail.boxScore.home];

    // Every athlete in the captured response has one, so an empty string here
    // means the field was dropped on the way through rather than missing.
    expect(lines.every((line) => /^\d+$/.test(line.jerseyNumber))).toBe(true);
  });

  it('produces team stats with shares inside 0 to 1', () => {
    expect(detail.teamStats.length).toBeGreaterThan(0);
    for (const stat of detail.teamStats) {
      expect(stat.awayShare).toBeGreaterThanOrEqual(0);
      expect(stat.awayShare).toBeLessThanOrEqual(1);
    }
  });

  it('carries no pre-game form once the game has been played', () => {
    expect(detail.teamForm).toEqual([]);
  });
});

/**
 * Before tip-off ESPN reuses `boxscore.teams[].statistics` for season
 * averages. Reading it with the played-game labels is what used to leave the
 * panel with two rows.
 */
describe('normalizeEspnSummary — before tip-off', () => {
  const detail = normalizeEspnSummary(pregameSummary);

  it('is a scheduled game with nothing played to show', () => {
    expect(detail.state.status).toBe('scheduled');
    expect(detail.periods).toEqual([]);
    expect(detail.boxScore.away).toEqual([]);
    expect(detail.boxScore.home).toEqual([]);
  });

  it('reads the eight season averages in the order the design shows them', () => {
    expect(detail.teamStats.map((stat) => stat.label)).toEqual([
      'Points Per Game',
      'Points Allowed',
      'Field Goal %',
      '3-Point %',
      'Rebounds',
      'Assists',
      'Steals',
      'Turnovers',
    ]);
  });

  it('suffixes only the percentages and leaves the averages alone', () => {
    const byLabel = new Map(detail.teamStats.map((stat) => [stat.label, stat]));

    // ESPN sends "45", not "45%" — the suffix is ours.
    expect(byLabel.get('Field Goal %')?.awayValue).toMatch(/^\d+(\.\d+)?%$/);
    expect(byLabel.get('Points Per Game')?.awayValue).not.toContain('%');
  });

  it('sizes every bar from the pair', () => {
    for (const stat of detail.teamStats) {
      expect(stat.awayShare).toBeGreaterThan(0);
      expect(stat.awayShare).toBeLessThan(1);
    }
  });

  it('reads streak and last ten as form, with no share to split', () => {
    expect(detail.teamForm).toEqual([
      { label: 'Streak', awayValue: expect.any(String), homeValue: expect.any(String) },
      { label: 'Last 10', awayValue: expect.any(String), homeValue: expect.any(String) },
    ]);
  });

  it('satisfies the domain schema', () => {
    expect(() => parseOrThrow(gameDetailSchema, detail, detail.id)).not.toThrow();
  });
});

describe('normalizeTeamForm', () => {
  const team = (statistics: { name: string; displayValue: string }[]) => ({
    team: { id: '1', abbreviation: 'AAA', displayName: 'Team A' },
    statistics,
  });

  it('omits a line one side is missing rather than half-filling it', () => {
    const lines = normalizeTeamForm(
      team([{ name: 'streak', displayValue: 'W5' }]),
      team([
        { name: 'streak', displayValue: 'L2' },
        { name: 'Last Ten Games', displayValue: '4-6' },
      ]),
    );

    expect(lines.map((line) => line.label)).toEqual(['Streak']);
  });

  it('returns nothing when a side is absent entirely', () => {
    expect(normalizeTeamForm(undefined, undefined)).toEqual([]);
  });
});

describe('normalizeEspnPlays', () => {
  const plays = normalizeEspnPlays(summary);

  it('reverses the feed into newest-first', () => {
    const last = summary.plays?.at(-1);
    expect(plays[0]?.id).toBe(last?.id);
  });

  it('omits the team on a game-level event rather than inventing one', () => {
    const endOfGame = plays.find((p) => p.description === 'End of Game');
    expect(endOfGame).toBeDefined();
    expect(endOfGame?.teamId).toBeUndefined();
  });

  it('carries a running score on every play', () => {
    for (const play of plays) {
      expect(Number.isFinite(play.awayScore)).toBe(true);
      expect(Number.isFinite(play.homeScore)).toBe(true);
    }
  });

  it('returns nothing when the summary has no plays block', () => {
    expect(normalizeEspnPlays({ header: summary.header })).toEqual([]);
  });
});
