import { describe, expect, it } from 'vitest';
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

  it('marks the date in the URL as selected', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider(),
      route: '/?date=2026-11-04',
    });

    const selected = await screen.findByRole('button', {
      pressed: true,
      name: /November 4/,
    });
    expect(selected).toBeInTheDocument();
  });

  it('ignores a nonsense date rather than showing a broken strip', async () => {
    renderWithProviders(<GamesPage />, {
      provider: provider(),
      route: '/?date=2026-13-45',
    });

    // Falls back to today, which is the only button labelled "Today".
    expect(await screen.findByText('Today')).toBeInTheDocument();
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
