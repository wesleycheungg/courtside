import { describe, expect, it } from 'vitest';
import { pickStatLeaders } from './statLeaders';
import { aBoxScore, aStatLine } from '../test/builders';

describe('pickStatLeaders', () => {
  it('returns points, rebounds, and assists leaders for each side', () => {
    const box = aBoxScore({
      away: [
        aStatLine({ playerId: 'a1', points: 30, rebounds: 2, assists: 3 }),
        aStatLine({ playerId: 'a2', points: 10, rebounds: 12, assists: 4 }),
        aStatLine({ playerId: 'a3', points: 8, rebounds: 5, assists: 11 }),
      ],
      home: [
        aStatLine({ playerId: 'h1', points: 22, rebounds: 9, assists: 2 }),
        aStatLine({ playerId: 'h2', points: 12, rebounds: 3, assists: 9 }),
      ],
    });

    const leaders = pickStatLeaders(box);

    expect(leaders.map((l) => l.stat)).toEqual(['points', 'rebounds', 'assists']);
    expect(leaders.map((l) => l.away.playerId)).toEqual(['a1', 'a2', 'a3']);
    expect(leaders.map((l) => l.home.playerId)).toEqual(['h1', 'h1', 'h2']);
  });

  it('keeps the first player when two are tied', () => {
    const box = aBoxScore({
      away: [
        aStatLine({ playerId: 'first', points: 20 }),
        aStatLine({ playerId: 'second', points: 20 }),
      ],
      home: [aStatLine({ playerId: 'h1' })],
    });

    expect(pickStatLeaders(box)[0]?.away.playerId).toBe('first');
  });

  it('still picks a leader when every value is 0', () => {
    const zero = { points: 0, rebounds: 0, assists: 0 };
    const box = aBoxScore({
      away: [aStatLine({ playerId: 'a1', ...zero })],
      home: [aStatLine({ playerId: 'h1', ...zero })],
    });

    expect(pickStatLeaders(box)).toHaveLength(3);
  });

  it('returns nothing when either side has no lines', () => {
    expect(pickStatLeaders({ away: [], home: [aStatLine()] })).toEqual([]);
    expect(pickStatLeaders({ away: [aStatLine()], home: [] })).toEqual([]);
    expect(pickStatLeaders({ away: [], home: [] })).toEqual([]);
  });
});
