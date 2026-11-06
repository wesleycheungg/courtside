import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { GameDetailPage } from './GameDetailPage';
import { renderWithProviders } from '../../test/render';
import {
  aGameDetail,
  finalState,
  scheduledState,
  stubProvider,
} from '../../test/builders';

function renderWith(detail: ReturnType<typeof aGameDetail>) {
  return renderWithProviders(<GameDetailPage />, {
    path: '/game/:gameId',
    route: '/game/g1',
    provider: stubProvider({ getGame: () => Promise.resolve(detail) }),
  });
}

const SEASON_STATS = [
  'Points Per Game',
  'Points Allowed',
  'Field Goal %',
  '3-Point %',
  'Rebounds',
  'Assists',
  'Steals',
  'Turnovers',
];

/** The panel the provider fills with season averages before tip-off. */
const pregame = aGameDetail({
  id: 'g1',
  state: scheduledState,
  periods: [],
  boxScore: { away: [], home: [] },
  topPerformers: [],
  statLeaders: [],
  teamStats: SEASON_STATS.map((label, index) => ({
    label,
    awayValue: `${110 + index}`,
    homeValue: `${100 + index}`,
    awayShare: 0.52,
  })),
  teamForm: [
    { label: 'Streak', awayValue: 'W5', homeValue: 'L2' },
    { label: 'Last 10', awayValue: '8-1', homeValue: '4-4' },
  ],
});

async function panel(name: string) {
  const heading = await screen.findByRole('heading', { name });
  const section = heading.closest('section');
  if (!section) throw new Error(`${name} panel not found`);
  return section;
}

describe('SummaryTab before tip-off', () => {
  it('heads the panel Season Averages, not Team Stats', async () => {
    renderWith(pregame);

    expect(await panel('Season Averages')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Team Stats' })).not.toBeInTheDocument();
  });

  it('lists all eight season averages with both sides', async () => {
    renderWith(pregame);
    const section = await panel('Season Averages');

    for (const label of SEASON_STATS) {
      expect(within(section).getByText(label)).toBeInTheDocument();
    }
    expect(within(section).getByText('110')).toBeInTheDocument();
    expect(within(section).getByText('100')).toBeInTheDocument();
  });

  it('shows streak and last ten without a comparison bar', async () => {
    renderWith(pregame);
    const section = await panel('Season Averages');

    const streak = within(section).getByText('Streak').closest('li');
    if (!streak) throw new Error('Streak row not found');

    expect(within(streak).getByText('W5')).toBeInTheDocument();
    expect(within(streak).getByText('L2')).toBeInTheDocument();
    // A record has no magnitude, so there is nothing to split into a bar.
    expect(streak.querySelector('.team-stats__bar')).toBeNull();
  });

  it('hides the linescore and game leaders, which have nothing to show yet', async () => {
    renderWith(pregame);

    await screen.findByRole('heading', { name: 'Season Averages' });
    expect(screen.queryByRole('heading', { name: 'Linescore' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Game Leaders' }),
    ).not.toBeInTheDocument();
  });

  it('still says stats are pending when the provider sends none', async () => {
    renderWith(aGameDetail({ ...pregame, teamStats: [], teamForm: [] }));

    expect(
      await screen.findByText('Stats appear once the game tips off.'),
    ).toBeInTheDocument();
  });
});

describe('SummaryTab after tip-off', () => {
  it('heads the panel Team Stats, so played stats are never labelled as averages', async () => {
    renderWith(aGameDetail({ id: 'g1', state: finalState }));

    expect(await panel('Team Stats')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Season Averages' }),
    ).not.toBeInTheDocument();
  });
});
