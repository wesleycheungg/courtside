import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameDetailPage } from './GameDetailPage';
import { renderWithProviders } from '../../test/render';
import {
  aBoxScore,
  aGameDetail,
  aStatLine,
  finalState,
  stubProvider,
} from '../../test/builders';
import { pickStatLeaders } from '../../data/statLeaders';

function renderWith(detail: ReturnType<typeof aGameDetail>) {
  return renderWithProviders(<GameDetailPage />, {
    path: '/game/:gameId',
    route: '/game/g1',
    provider: stubProvider({ getGame: () => Promise.resolve(detail) }),
  });
}

describe('Game Leaders', () => {
  const boxScore = aBoxScore({
    away: [aStatLine({ playerId: 'a1', name: 'Jalen Brunson', points: 31 })],
    home: [aStatLine({ playerId: 'h1', name: 'Jayson Tatum', points: 27 })],
  });
  const detail = aGameDetail({
    id: 'g1',
    state: finalState,
    boxScore,
    statLeaders: pickStatLeaders(boxScore),
  });

  it('shows a row for points, rebounds, and assists with both leaders', async () => {
    renderWith(detail);

    const heading = await screen.findByRole('heading', { name: 'Game Leaders' });
    const panel = heading.closest('section');
    if (!panel) throw new Error('Game Leaders panel not found');

    for (const label of ['Points', 'Rebounds', 'Assists']) {
      expect(within(panel).getByText(label)).toBeInTheDocument();
    }
    expect(within(panel).getAllByText('Jalen Brunson')).toHaveLength(3);
    expect(within(panel).getAllByText('Jayson Tatum')).toHaveLength(3);
    expect(within(panel).getByText('31')).toBeInTheDocument();
    expect(within(panel).getByText('27')).toBeInTheDocument();
  });

  it('is hidden when there are no leaders', async () => {
    renderWith(aGameDetail({ id: 'g1', state: finalState, statLeaders: [] }));

    await screen.findByRole('tab', { name: 'Summary' });
    expect(screen.queryByRole('heading', { name: 'Game Leaders' })).not.toBeInTheDocument();
  });

  it('"Full Box Score" opens the box score tab', async () => {
    const user = userEvent.setup();
    renderWith(detail);

    await user.click(await screen.findByRole('link', { name: 'Full Box Score' }));

    expect(screen.getByRole('tab', { name: 'Box score' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
