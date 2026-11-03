import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { PlayerPage } from './PlayerPage';
import { renderWithProviders } from '../../test/render';
import { aPlayer, stubProvider } from '../../test/builders';

function renderPlayer(player = aPlayer(), id = 'tatum') {
  return renderWithProviders(<PlayerPage />, {
    path: '/player/:playerId',
    route: `/player/${id}`,
    provider: stubProvider({ getPlayer: () => Promise.resolve(player) }),
  });
}

describe('PlayerPage — header', () => {
  it('shows the name, team, position and bio', async () => {
    renderPlayer();

    expect(
      await screen.findByRole('heading', { name: 'Jayson Tatum' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Boston Celtics · Forward')).toBeInTheDocument();
    expect(screen.getByText(/6' 8" · 28 yrs · season 10/)).toBeInTheDocument();
  });

  it('offers a way back', async () => {
    renderPlayer();

    expect(await screen.findByRole('link', { name: 'Back to games' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});

describe('PlayerPage — season averages', () => {
  it('renders a tile per stat, with its league rank', async () => {
    renderPlayer(
      aPlayer({
        seasonAverages: [
          { label: 'PTS', value: '27.4', rank: 6 },
          { label: 'REB', value: '8.6', rank: 18 },
        ],
      }),
    );

    expect(await screen.findByText('27.4')).toBeInTheDocument();
    expect(screen.getByText('#6 NBA')).toBeInTheDocument();
    expect(screen.getByText('8.6')).toBeInTheDocument();
  });

  it('omits the rank when the provider does not report one', async () => {
    renderPlayer(aPlayer({ seasonAverages: [{ label: 'PTS', value: '27.4' }] }));

    expect(await screen.findByText('27.4')).toBeInTheDocument();
    expect(screen.queryByText(/NBA$/)).not.toBeInTheDocument();
  });

  it('hides the panel entirely when there are no averages', async () => {
    renderPlayer(aPlayer({ seasonAverages: [] }));

    await screen.findByRole('heading', { name: 'Jayson Tatum' });
    expect(screen.queryByText('Season averages')).not.toBeInTheDocument();
  });
});

describe('PlayerPage — game log', () => {
  const player = aPlayer({
    gameLog: [
      {
        gameId: 'g1',
        opponentAbbreviation: 'NYK',
        isHome: true,
        result: 'W 121-108',
        points: 28,
        rebounds: 9,
        assists: 5,
        fieldGoalsMade: 10,
        fieldGoalsAttempted: 19,
      },
      {
        gameId: 'g2',
        opponentAbbreviation: 'CLE',
        isHome: false,
        result: 'L 104-112',
        points: 22,
        rebounds: 10,
        assists: 4,
        fieldGoalsMade: 8,
        fieldGoalsAttempted: 20,
      },
    ],
  });

  it('marks home games with vs and away games with @', async () => {
    renderPlayer(player);
    const table = await screen.findByRole('table');

    expect(within(table).getByText('vs NYK')).toBeInTheDocument();
    expect(within(table).getByText('@ CLE')).toBeInTheDocument();
  });

  it('shows each result and stat line', async () => {
    renderPlayer(player);
    const table = await screen.findByRole('table');

    expect(within(table).getByText('W 121-108')).toBeInTheDocument();
    expect(within(table).getByText('10-19')).toBeInTheDocument();
  });

  it('charts the same games, oldest first', async () => {
    renderPlayer(player);

    expect(await screen.findByText('Points, last 2 games')).toBeInTheDocument();
  });

  it('hides both panels when there is no game log', async () => {
    renderPlayer(aPlayer({ gameLog: [] }));

    await screen.findByRole('heading', { name: 'Jayson Tatum' });
    expect(screen.queryByText('Game log')).not.toBeInTheDocument();
    expect(screen.queryByText(/Points, last/)).not.toBeInTheDocument();
  });
});

describe('PlayerPage — shooting', () => {
  it('shows percentage alongside makes and attempts', async () => {
    renderPlayer(
      aPlayer({
        shootingSplits: [
          { label: 'Three pointers', made: 32, attempted: 89, percent: 36 },
        ],
      }),
    );

    expect(await screen.findByText('Three pointers')).toBeInTheDocument();
    expect(screen.getByText('32/89')).toBeInTheDocument();
    expect(screen.getByText(/36%/)).toBeInTheDocument();
  });

  it('hides the panel when there are no splits', async () => {
    renderPlayer(aPlayer({ shootingSplits: [] }));

    await screen.findByRole('heading', { name: 'Jayson Tatum' });
    expect(screen.queryByText('Shooting')).not.toBeInTheDocument();
  });
});

describe('PlayerPage — failures', () => {
  it('reports a failed load with a way back', async () => {
    renderWithProviders(<PlayerPage />, {
      path: '/player/:playerId',
      route: '/player/nobody',
      provider: stubProvider({
        getPlayer: () => Promise.reject(new Error('Unknown player: nobody')),
      }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Unknown player: nobody');
    expect(screen.getByRole('link', { name: 'Back to games' })).toBeInTheDocument();
  });

  it('shows a loading state before data arrives', () => {
    renderWithProviders(<PlayerPage />, {
      path: '/player/:playerId',
      route: '/player/tatum',
      provider: stubProvider({ getPlayer: () => new Promise(() => {}) }),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading player');
  });
});
