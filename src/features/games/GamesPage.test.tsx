import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GamesPage } from './GamesPage';
import { renderWithProviders } from '../../test/render';
import {
  aGame,
  aTeam,
  finalState,
  liveState,
  scheduledState,
  stubProvider,
} from '../../test/builders';

const slate = [
  aGame({ id: 'sched', state: scheduledState, startsAt: '2026-11-03T02:00:00.000Z' }),
  aGame({ id: 'final', state: finalState, startsAt: '2026-11-02T23:00:00.000Z' }),
  aGame({
    id: 'live',
    state: liveState,
    startsAt: '2026-11-02T23:30:00.000Z',
    away: aTeam({ id: 'nyk', name: 'Knicks', abbreviation: 'NYK' }),
  }),
];

function provider(games = slate) {
  return stubProvider({ getGames: () => Promise.resolve(games) });
}

describe('GamesPage', () => {
  it('renders the slate grouped under a league header', async () => {
    renderWithProviders(<GamesPage />, { provider: provider() });

    expect(await screen.findByRole('heading', { name: 'NBA' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Knicks at Celtics/ })).toHaveLength(3);
  });

  it('orders live before final before scheduled', async () => {
    renderWithProviders(<GamesPage />, { provider: provider() });

    const rows = await screen.findAllByRole('link', { name: /Knicks at Celtics/ });
    const hrefs = rows.map((row) => row.getAttribute('href'));

    expect(hrefs).toEqual(['/game/live', '/game/final', '/game/sched']);
  });

  it('shows an accurate live count on the filter chip', async () => {
    renderWithProviders(<GamesPage />, { provider: provider() });

    expect(await screen.findByRole('button', { name: 'Live (1)' })).toBeInTheDocument();
  });

  it('drops the count when nothing is live', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider([aGame({ state: finalState })]),
    });

    expect(await screen.findByRole('button', { name: 'Live' })).toBeInTheDocument();
  });

  it('narrows to live games when the Live filter is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GamesPage />, { provider: provider() });

    await user.click(await screen.findByRole('button', { name: 'Live (1)' }));

    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /Knicks at Celtics/ })).toHaveLength(1),
    );
  });

  it('starts on the filter named in the URL', async () => {
    renderWithProviders(<GamesPage />, { provider: provider(), route: '/?filter=live' });

    expect(await screen.findByRole('button', { name: 'Live (1)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('explains an empty slate', async () => {
    renderWithProviders(<GamesPage />, { provider: provider([]) });

    expect(await screen.findByText('No games on this date.')).toBeInTheDocument();
  });

  it('says why the list is empty when a filter is the reason', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider([aGame({ state: finalState })]),
      route: '/?filter=live',
    });

    expect(await screen.findByText('No games are live right now.')).toBeInTheDocument();
  });

  it('reports a failure instead of rendering an empty feed', async () => {
    const failing = stubProvider({
      getGames: () => Promise.reject(new Error('upstream exploded')),
    });
    renderWithProviders(<GamesPage />, { provider: failing });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not load games');
    expect(alert).toHaveTextContent('upstream exploded');
  });

  it('shows a loading state before data arrives', () => {
    renderWithProviders(<GamesPage />, {
      provider: stubProvider({ getGames: () => new Promise(() => {}) }),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading games');
  });

  it('shows the date from the URL on the picker', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider(),
      route: '/?date=2026-11-04',
    });

    // The trigger carries the full date in its accessible name whatever the
    // visible wording works out to, so this holds on any day of the year.
    expect(await screen.findByRole('button', { name: /November 4/ })).toBeInTheDocument();
  });

  it('ignores a nonsense date rather than showing a broken picker', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider(),
      route: '/?date=2026-13-45',
    });

    // Falls back to today, which is what the picker then names.
    expect(await screen.findByText('Today')).toBeInTheDocument();
  });

  it('asks the provider for the new day when the picker steps forward', async () => {
    const user = userEvent.setup();
    const getGames = vi.fn().mockResolvedValue(slate);
    renderWithProviders(<GamesPage />, {
      provider: stubProvider({ getGames }),
      route: '/?date=2026-11-04',
    });

    await screen.findByRole('heading', { name: 'NBA' });
    await user.click(screen.getByRole('button', { name: 'Next day' }));

    await waitFor(() => expect(getGames).toHaveBeenCalledWith('2026-11-05'));
  });

  it('loads the day picked out of the calendar', async () => {
    const user = userEvent.setup();
    const getGames = vi.fn().mockResolvedValue(slate);
    renderWithProviders(<GamesPage />, {
      provider: stubProvider({ getGames }),
      route: '/?date=2026-11-04',
    });

    await screen.findByRole('heading', { name: 'NBA' });
    await user.click(screen.getByRole('button', { name: /November 4/ }));
    await user.click(
      screen.getByRole('button', { name: /November 17, 2026|17 November 2026/ }),
    );

    await waitFor(() => expect(getGames).toHaveBeenCalledWith('2026-11-17'));
  });

  it('credits mock data as sample data', async () => {
    renderWithProviders(<GamesPage />, {
      provider: stubProvider({ name: 'mock', getGames: () => Promise.resolve([]) }),
    });

    expect(await screen.findByText('Sample data for demo purposes')).toBeInTheDocument();
  });

  it('attributes ESPN when the live provider is serving', async () => {
    renderWithProviders(<GamesPage />, {
      provider: stubProvider({ name: 'espn', getGames: () => Promise.resolve([]) }),
    });

    expect(
      await screen.findByText(/Unofficial data from ESPN\. Not affiliated/),
    ).toBeInTheDocument();
  });
});
