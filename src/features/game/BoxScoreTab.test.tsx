import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameDetailPage } from './GameDetailPage';
import { renderWithProviders } from '../../test/render';
import {
  aGameDetail,
  aRosterEntry,
  finalState,
  scheduledState,
  stubProvider,
} from '../../test/builders';
import type { RosterEntry } from '../../data/types';

/** Scheduled, with the empty box score a game before tip-off really has. */
const pregame = aGameDetail({
  id: 'g1',
  state: scheduledState,
  boxScore: { away: [], home: [] },
  topPerformers: [],
  statLeaders: [],
  periods: [],
  teamStats: [],
});

const celtics: RosterEntry[] = [
  aRosterEntry({ playerId: 'tatum', name: 'Jayson Tatum', jerseyNumber: '0' }),
  aRosterEntry({
    playerId: 'white',
    name: 'Derrick White',
    position: 'G',
    jerseyNumber: '9',
    seasonAverages: { points: 16.4, rebounds: 4.2, assists: 5.0, fieldGoalPercent: 44.1 },
  }),
];

const knicks: RosterEntry[] = [
  aRosterEntry({ playerId: 'brunson', name: 'Jalen Brunson', position: 'G' }),
];

function renderPregame(
  getTeamRoster: (teamId: string) => Promise<RosterEntry[]>,
  route = '/game/g1?tab=boxscore',
) {
  return renderWithProviders(<GameDetailPage />, {
    path: '/game/:gameId',
    route,
    provider: stubProvider({
      getGame: () => Promise.resolve(pregame),
      getTeamRoster,
    }),
  });
}

/** The home side is BOS and the away side NYK, per the game builders. */
const bothRosters = (teamId: string) =>
  Promise.resolve(teamId === 'bos' ? celtics : knicks);

describe('BoxScoreTab before tip-off', () => {
  it('announces that the roster is loading', async () => {
    renderPregame(() => new Promise<RosterEntry[]>(() => {}));

    // Wait for the game itself, so the status found is the roster's and not
    // the whole page's skeleton.
    await screen.findByRole('button', { name: 'BOS' });
    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading roster');
  });

  it('lists the home roster with its season averages', async () => {
    renderPregame(bothRosters);

    expect(await screen.findByRole('link', { name: 'J. Tatum' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'D. White' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '27.4' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '46.2' })).toBeInTheDocument();
  });

  it('says these are season numbers, not numbers from a game not yet played', async () => {
    renderPregame(bothRosters);

    expect(await screen.findByText('Season averages')).toBeInTheDocument();
  });

  it('heads the table with the jersey, player, position and four averages', async () => {
    renderPregame(bothRosters);

    await screen.findByRole('link', { name: 'J. Tatum' });
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);

    expect(headers).toEqual(['#', 'Player', 'POS', 'PTS', 'REB', 'AST', 'FG%']);
  });

  it('links a roster row to that player', async () => {
    renderPregame(bothRosters);

    expect(await screen.findByRole('link', { name: 'J. Tatum' })).toHaveAttribute(
      'href',
      '/player/tatum',
    );
  });

  it('shows the jersey number alongside the name', async () => {
    renderPregame(bothRosters);

    await screen.findByRole('link', { name: 'J. Tatum' });
    const row = screen.getByRole('row', { name: /J\. Tatum/ });

    expect(within(row).getByRole('cell', { name: '0' })).toBeInTheDocument();
  });

  it('fetches the other roster when the team chip changes', async () => {
    const user = userEvent.setup();
    const getTeamRoster = vi.fn(bothRosters);
    renderPregame(getTeamRoster);

    await screen.findByRole('link', { name: 'J. Tatum' });
    await user.click(screen.getByRole('button', { name: 'NYK' }));

    expect(await screen.findByRole('link', { name: 'J. Brunson' })).toBeInTheDocument();
    expect(getTeamRoster).toHaveBeenCalledWith('bos');
    expect(getTeamRoster).toHaveBeenCalledWith('nyk');
  });

  it('dashes every stat for a player with no games played', async () => {
    renderPregame(() =>
      Promise.resolve([
        aRosterEntry({ playerId: 'peat', name: 'Koa Peat', seasonAverages: undefined }),
      ]),
    );

    await screen.findByRole('link', { name: 'K. Peat' });
    const row = screen.getByRole('row', { name: /K\. Peat/ });

    // PTS, REB, AST and FG% — a zero would read as a player who scored none.
    expect(within(row).getAllByRole('cell', { name: '—' })).toHaveLength(4);
  });

  it('reports a roster failure without taking the rest of the page down', async () => {
    renderPregame(() => Promise.reject(new Error('upstream exploded')));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the BOS roster.',
    );
    // The game itself loaded fine, so its header is still there.
    expect(screen.getByText('Celtics')).toBeInTheDocument();
  });

  it('says so when a roster comes back empty', async () => {
    renderPregame(() => Promise.resolve([]));

    expect(await screen.findByText('No roster available yet.')).toBeInTheDocument();
  });
});

describe('BoxScoreTab after tip-off', () => {
  it('never asks for a roster once there is a real box score', async () => {
    const getTeamRoster = vi.fn(() => Promise.resolve(celtics));

    renderWithProviders(<GameDetailPage />, {
      path: '/game/:gameId',
      route: '/game/g1?tab=boxscore',
      provider: stubProvider({
        getGame: () => Promise.resolve(aGameDetail({ id: 'g1', state: finalState })),
        getTeamRoster,
      }),
    });

    expect(await screen.findByRole('link', { name: 'J. Tatum' })).toBeInTheDocument();
    expect(screen.queryByText('Season averages')).not.toBeInTheDocument();
    expect(getTeamRoster).not.toHaveBeenCalled();
  });
});
