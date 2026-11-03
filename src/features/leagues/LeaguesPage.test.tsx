import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeaguesPage } from './LeaguesPage';
import { renderWithProviders } from '../../test/render';
import { aConference, aStanding, aTeam, stubProvider } from '../../test/builders';

/** Fifteen teams, so the playoff and play-in cutoffs both appear. */
function conferenceOf(id: 'east' | 'west', prefix: string) {
  return aConference({
    id,
    name: id === 'east' ? 'Eastern Conference' : 'Western Conference',
    standings: Array.from({ length: 15 }, (_, i) =>
      aStanding({
        rank: i + 1,
        team: aTeam({
          id: `${prefix}${i}`,
          name: `${prefix} Team ${i + 1}`,
          abbreviation: `T${i + 1}`,
        }),
        wins: 15 - i,
        losses: i,
        winPercent: (15 - i) / 15,
        gamesBehind: i === 0 ? 0 : i,
        streak: i % 2 === 0 ? 'W2' : 'L1',
      }),
    ),
  });
}

const conferences = [conferenceOf('east', 'East'), conferenceOf('west', 'West')];

function provider() {
  return stubProvider({ getStandings: () => Promise.resolve(conferences) });
}

describe('LeaguesPage', () => {
  it('shows the Eastern conference by default', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });

    // The buttons render before the fetch resolves, so wait on the data.
    expect(await screen.findByText('East Team 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'East' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('switches conference and keeps it in the URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LeaguesPage />, { provider: provider() });

    await screen.findByText('East Team 1');
    await user.click(screen.getByRole('button', { name: 'West' }));

    expect(await screen.findByText('West Team 1')).toBeInTheDocument();
    expect(screen.queryByText('East Team 1')).not.toBeInTheDocument();
  });

  it('starts on the conference named in the URL', async () => {
    renderWithProviders(<LeaguesPage />, {
      provider: provider(),
      route: '/leagues?conf=west',
    });

    expect(await screen.findByText('West Team 1')).toBeInTheDocument();
  });

  it('renders every standings column', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });
    const table = await screen.findByRole('table');

    for (const column of ['Team', 'W', 'L', 'PCT', 'GB', 'STRK']) {
      expect(
        within(table).getByRole('columnheader', { name: column }),
      ).toBeInTheDocument();
    }
  });

  it('lists all fifteen teams in rank order', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });
    const table = await screen.findByRole('table');

    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(15);
    expect(rows[0]).toHaveTextContent('East Team 1');
    expect(rows[14]).toHaveTextContent('East Team 15');
  });

  it('shows a dash rather than 0 games behind for the leader', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });
    const table = await screen.findByRole('table');

    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('—');
  });

  it('announces playoff and play-in positions, not colour alone', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);

    // Seeds 1-6 playoffs, 7-10 play-in, 11+ unmarked.
    expect(rows[0]).toHaveTextContent('Playoff position');
    expect(rows[5]).toHaveTextContent('Playoff position');
    expect(rows[6]).toHaveTextContent('Play-in position');
    expect(rows[9]).toHaveTextContent('Play-in position');
    expect(rows[10]).not.toHaveTextContent('position');
  });

  it('explains the bands in a caption as well as a legend', async () => {
    renderWithProviders(<LeaguesPage />, { provider: provider() });

    expect(
      await screen.findByText(/Seeds 1 to 6 reach the playoffs/),
    ).toBeInTheDocument();
    expect(screen.getByText('Playoffs (1–6)')).toBeInTheDocument();
    expect(screen.getByText('Play-in (7–10)')).toBeInTheDocument();
  });

  it('reports a failure instead of an empty table', async () => {
    renderWithProviders(<LeaguesPage />, {
      provider: stubProvider({
        getStandings: () => Promise.reject(new Error('standings down')),
      }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('standings down');
  });

  it('shows a loading state before data arrives', () => {
    renderWithProviders(<LeaguesPage />, {
      provider: stubProvider({ getStandings: () => new Promise(() => {}) }),
    });

    expect(screen.getByRole('status')).toHaveTextContent('Loading standings');
  });
});
