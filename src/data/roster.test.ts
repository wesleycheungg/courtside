import { describe, expect, it } from 'vitest';
import { sortRoster } from './roster';
import { aRosterEntry } from '../test/builders';

const averages = (points: number) => ({
  points,
  rebounds: 4,
  assists: 3,
  fieldGoalPercent: 45,
});

describe('sortRoster', () => {
  it('puts the best scorers first', () => {
    const sorted = sortRoster([
      aRosterEntry({ playerId: 'c', name: 'Cedi Osman', seasonAverages: averages(9.1) }),
      aRosterEntry({
        playerId: 'a',
        name: 'Donovan Mitchell',
        seasonAverages: averages(28.4),
      }),
      aRosterEntry({
        playerId: 'b',
        name: 'Evan Mobley',
        seasonAverages: averages(17.2),
      }),
    ]);

    expect(sorted.map((entry) => entry.playerId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts a player with no games played last, not as a zero scorer', () => {
    const sorted = sortRoster([
      aRosterEntry({ playerId: 'rookie', name: 'Koa Peat', seasonAverages: undefined }),
      aRosterEntry({
        playerId: 'bench',
        name: 'Pat Spencer',
        seasonAverages: averages(0),
      }),
      aRosterEntry({
        playerId: 'star',
        name: 'Devin Booker',
        seasonAverages: averages(24.7),
      }),
    ]);

    expect(sorted.map((entry) => entry.playerId)).toEqual(['star', 'bench', 'rookie']);
  });

  it('breaks a tie by name, so the order never wobbles between runs', () => {
    const sorted = sortRoster([
      aRosterEntry({
        playerId: 'z',
        name: 'Zion Williamson',
        seasonAverages: averages(20),
      }),
      aRosterEntry({ playerId: 'a', name: 'Aaron Gordon', seasonAverages: averages(20) }),
    ]);

    expect(sorted.map((entry) => entry.playerId)).toEqual(['a', 'z']);
  });

  it('orders players with no averages among themselves by name', () => {
    const sorted = sortRoster([
      aRosterEntry({ playerId: 'w', name: 'Mark Williams', seasonAverages: undefined }),
      aRosterEntry({ playerId: 't', name: 'Drew Timme', seasonAverages: undefined }),
    ]);

    expect(sorted.map((entry) => entry.playerId)).toEqual(['t', 'w']);
  });

  it('does not mutate the list it was given', () => {
    const entries = [
      aRosterEntry({ playerId: 'low', seasonAverages: averages(4) }),
      aRosterEntry({ playerId: 'high', seasonAverages: averages(30) }),
    ];

    sortRoster(entries);

    expect(entries.map((entry) => entry.playerId)).toEqual(['low', 'high']);
  });
});
