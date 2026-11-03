import { describe, expect, it } from 'vitest';
import { espnSummarySchema } from './espnSchemas';
import {
  normalizeEspnPlays,
  normalizeEspnSummary,
  normalizePlayerGroup,
  pickTopPerformers,
  shareOf,
  statToNumber,
} from './normalizeSummary';
import { gameDetailSchema, parseOrThrow } from '../schemas';
import summaryFixture from './fixtures/summary-final-401909907.json';
import { aBoxScore, aStatLine } from '../../test/builders';

const summary = espnSummarySchema.parse(summaryFixture);

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
              athlete: { id: '9', displayName: 'Test Player' },
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

  it('produces team stats with shares inside 0 to 1', () => {
    expect(detail.teamStats.length).toBeGreaterThan(0);
    for (const stat of detail.teamStats) {
      expect(stat.awayShare).toBeGreaterThanOrEqual(0);
      expect(stat.awayShare).toBeLessThanOrEqual(1);
    }
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
