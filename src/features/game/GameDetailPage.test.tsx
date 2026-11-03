import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameDetailPage } from './GameDetailPage';
import { renderWithProviders } from '../../test/render';
import {
  aBoxScore,
  aGameDetail,
  aPlay,
  aStatLine,
  finalState,
  liveState,
  scheduledState,
  stubProvider,
} from '../../test/builders';

const detail = aGameDetail({
  id: 'g1',
  state: finalState,
  awayScore: 104,
  homeScore: 118,
});

function provider(overrides = {}) {
  return stubProvider({
    getGame: () => Promise.resolve(detail),
    getPlayByPlay: () => Promise.resolve([aPlay()]),
    ...overrides,
  });
}

function renderDetail(
  options: { route?: string; provider?: ReturnType<typeof provider> } = {},
) {
  return renderWithProviders(<GameDetailPage />, {
    path: '/game/:gameId',
    route: options.route ?? '/game/g1',
    provider: options.provider ?? provider(),
  });
}

describe('GameDetailPage — header', () => {
  it('shows both teams and the score', async () => {
    renderDetail();

    expect(await screen.findByText('Knicks')).toBeInTheDocument();
    expect(screen.getByText('Celtics')).toBeInTheDocument();
  });

  it('gives the scoreline an accessible name naming both teams', async () => {
    renderDetail();

    // Without a label the big scoreline reads as a bare "104 – 118".
    expect(await screen.findByText('Knicks 104, Celtics 118')).toBeInTheDocument();
  });

  it('shows the live period and clock while a game is in progress', async () => {
    renderDetail({
      provider: provider({
        getGame: () => Promise.resolve(aGameDetail({ state: liveState })),
      }),
    });

    expect(await screen.findByText(/Q3 · 4:12/)).toBeInTheDocument();
  });

  it('shows a tip-off time and no score before the game starts', async () => {
    renderDetail({
      provider: provider({
        getGame: () =>
          Promise.resolve(
            aGameDetail({
              state: scheduledState,
              awayScore: 0,
              homeScore: 0,
              periods: [],
            }),
          ),
      }),
    });

    expect(await screen.findByText('vs')).toBeInTheDocument();
  });
});

describe('GameDetailPage — tabs', () => {
  it('opens on Summary', async () => {
    renderDetail();

    expect(
      await screen.findByRole('tab', { name: 'Summary', selected: true }),
    ).toBeInTheDocument();
  });

  it('honours the tab named in the URL, so a refresh keeps your place', async () => {
    renderDetail({ route: '/game/g1?tab=boxscore' });

    expect(
      await screen.findByRole('tab', { name: 'Box score', selected: true }),
    ).toBeInTheDocument();
  });

  it('switches panels on click', async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(await screen.findByRole('tab', { name: 'Plays' }));

    expect(
      screen.getByRole('tab', { name: 'Plays', selected: true }),
    ).toBeInTheDocument();
  });

  it('falls back to Summary for an unknown tab', async () => {
    renderDetail({ route: '/game/g1?tab=nonsense' });

    expect(
      await screen.findByRole('tab', { name: 'Summary', selected: true }),
    ).toBeInTheDocument();
  });

  it('exposes exactly one selected tab at a time', async () => {
    renderDetail({ route: '/game/g1?tab=plays' });

    const selected = (await screen.findAllByRole('tab')).filter(
      (tab) => tab.getAttribute('aria-selected') === 'true',
    );
    expect(selected).toHaveLength(1);
  });
});

describe('GameDetailPage — summary', () => {
  it('renders every quarter plus a total', async () => {
    renderDetail();

    const table = await screen.findByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Q1' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'T' })).toBeInTheDocument();
  });

  it('shows quarter values that add up to the displayed total', async () => {
    renderDetail();
    await screen.findByText('Score by quarter');

    // 24+29+26+25 = 104 away, 31+28+30+29 = 118 home, as in the builder.
    const away = detail.periods.reduce((sum, p) => sum + p.awayScore, 0);
    const home = detail.periods.reduce((sum, p) => sum + p.homeScore, 0);

    expect(away).toBe(detail.awayScore);
    expect(home).toBe(detail.homeScore);
  });

  it('labels overtime periods', async () => {
    renderDetail({
      provider: provider({
        getGame: () =>
          Promise.resolve(
            aGameDetail({
              periods: [{ number: 5, label: 'OT1', awayScore: 14, homeScore: 11 }],
            }),
          ),
      }),
    });

    expect(await screen.findByRole('columnheader', { name: 'OT1' })).toBeInTheDocument();
  });

  it('says stats are pending rather than showing empty panels', async () => {
    renderDetail({
      provider: provider({
        getGame: () =>
          Promise.resolve(
            aGameDetail({
              periods: [],
              teamStats: [],
              topPerformers: [],
              boxScore: { away: [], home: [] },
            }),
          ),
      }),
    });

    expect(
      await screen.findByText('Stats appear once the game tips off.'),
    ).toBeInTheDocument();
  });
});

describe('GameDetailPage — box score', () => {
  it('lists players for the selected team and links to them', async () => {
    renderDetail({ route: '/game/g1?tab=boxscore' });

    const link = await screen.findByRole('link', { name: 'J. Tatum' });
    expect(link).toHaveAttribute('href', '/player/tatum');
  });

  it('switches teams', async () => {
    const user = userEvent.setup();
    renderDetail({ route: '/game/g1?tab=boxscore' });

    await user.click(await screen.findByRole('button', { name: 'NYK' }));

    expect(screen.getByRole('link', { name: 'J. Brunson' })).toBeInTheDocument();
  });

  it('abbreviates names and rounds minutes', async () => {
    renderDetail({
      route: '/game/g1?tab=boxscore',
      provider: provider({
        getGame: () =>
          Promise.resolve(
            aGameDetail({
              boxScore: aBoxScore({
                home: [aStatLine({ name: 'Jayson Tatum', minutes: 30.2 })],
              }),
            }),
          ),
      }),
    });

    expect(await screen.findByRole('link', { name: 'J. Tatum' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '30' })).toBeInTheDocument();
  });

  it('says so when a box score is not available yet', async () => {
    renderDetail({
      route: '/game/g1?tab=boxscore',
      provider: provider({
        getGame: () => Promise.resolve(aGameDetail({ boxScore: { away: [], home: [] } })),
      }),
    });

    expect(await screen.findByText('No box score yet.')).toBeInTheDocument();
  });
});

describe('GameDetailPage — plays', () => {
  it('lists plays with a running score', async () => {
    renderDetail({ route: '/game/g1?tab=plays' });

    expect(
      await screen.findByText(/makes 26-foot three point jumper/),
    ).toBeInTheDocument();
    expect(screen.getByText('82-87')).toBeInTheDocument();
  });

  it('says so when there are no plays yet', async () => {
    renderDetail({
      route: '/game/g1?tab=plays',
      provider: provider({ getPlayByPlay: () => Promise.resolve([]) }),
    });

    expect(await screen.findByText('No plays yet.')).toBeInTheDocument();
  });

  it('reports a play-by-play failure separately from the game itself', async () => {
    renderDetail({
      route: '/game/g1?tab=plays',
      provider: provider({
        getPlayByPlay: () => Promise.reject(new Error('plays unavailable')),
      }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('plays unavailable');
  });
});

describe('GameDetailPage — shots and failures', () => {
  it('explains the empty Shots tab rather than rendering a blank panel', async () => {
    renderDetail({ route: '/game/g1?tab=shots' });

    expect(
      await screen.findByText(/Shot charts need per-shot coordinates/),
    ).toBeInTheDocument();
  });

  it('reports a failed load with a way back', async () => {
    renderDetail({
      provider: stubProvider({
        getGame: () => Promise.reject(new Error('no such game')),
      }),
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('no such game');
    expect(screen.getByRole('link', { name: 'Back to games' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
