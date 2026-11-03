import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { GameRow } from './GameRow';
import { renderWithProviders } from '../../test/render';
import { aGame, aTeam, finalState, liveState, scheduledState } from '../../test/builders';

describe('GameRow — live', () => {
  const game = aGame({ state: liveState, awayScore: 82, homeScore: 87 });

  it('shows the period and clock', () => {
    renderWithProviders(<GameRow game={game} />);

    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Q3 4:12')).toBeInTheDocument();
  });

  it('shows both scores', () => {
    renderWithProviders(<GameRow game={game} />);

    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
  });

  it('drops the clock at a period break rather than showing a stopped one', () => {
    renderWithProviders(
      <GameRow
        game={aGame({
          state: { status: 'live', periodNumber: 2, periodLabel: 'Half', clock: '' },
        })}
      />,
    );

    expect(screen.getByText('Half')).toBeInTheDocument();
  });

  it('reads as one sentence to assistive tech', () => {
    renderWithProviders(<GameRow game={game} />);

    expect(
      screen.getByRole('link', { name: /^Knicks at Celtics, live, Q3 4:12, 82 to 87\./ }),
    ).toBeInTheDocument();
  });
});

describe('GameRow — final', () => {
  it('labels a regulation final', () => {
    renderWithProviders(<GameRow game={aGame({ state: finalState })} />);
    expect(screen.getByText('Final')).toBeInTheDocument();
  });

  it('flags overtime', () => {
    renderWithProviders(
      <GameRow game={aGame({ state: { status: 'final', wentToOvertime: true } })} />,
    );
    expect(screen.getByText('Final / OT')).toBeInTheDocument();
  });

  it('announces the result including overtime', () => {
    renderWithProviders(
      <GameRow
        game={aGame({
          state: { status: 'final', wentToOvertime: true },
          awayScore: 121,
          homeScore: 118,
        })}
      />,
    );

    expect(
      screen.getByRole('link', {
        name: /^Knicks at Celtics, final after overtime, 121 to 118\./,
      }),
    ).toBeInTheDocument();
  });
});

describe('GameRow — scheduled', () => {
  const game = aGame({ state: scheduledState, awayScore: 0, homeScore: 0 });

  it('shows no score before tip-off', () => {
    renderWithProviders(<GameRow game={game} />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows a tip-off time in the status column', () => {
    const { container } = renderWithProviders(<GameRow game={game} />);

    expect(container.querySelector('.game-row__detail')).toHaveTextContent(
      /\d{1,2}:\d{2}/,
    );
  });
});

describe('GameRow — links and records', () => {
  it('links to the game detail screen', () => {
    renderWithProviders(<GameRow game={aGame({ id: 'abc123' })} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/game/abc123');
  });

  it('shows each team record when the provider supplies one', () => {
    renderWithProviders(
      <GameRow
        game={aGame({
          away: aTeam({ name: 'Knicks', record: '4-3' }),
          home: aTeam({ record: '5-2' }),
        })}
      />,
    );

    expect(screen.getByText('4-3')).toBeInTheDocument();
    expect(screen.getByText('5-2')).toBeInTheDocument();
  });

  it('omits the record rather than showing a blank when there is none', () => {
    const { container } = renderWithProviders(
      <GameRow
        game={aGame({
          away: aTeam({ record: undefined }),
          home: aTeam({ record: undefined }),
        })}
      />,
    );

    expect(container.querySelectorAll('.game-row__record')).toHaveLength(0);
  });

  it('names both teams', () => {
    renderWithProviders(<GameRow game={aGame()} />);
    const row = screen.getByRole('link');

    expect(within(row).getByText('Knicks')).toBeInTheDocument();
    expect(within(row).getByText('Celtics')).toBeInTheDocument();
  });
});
