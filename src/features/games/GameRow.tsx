import { Link } from 'react-router-dom';
import { TeamLogo } from '../../components/TeamLogo';
import type { Game, TeamRef } from '../../data/types';
import { formatTipoff } from '../../lib/date';
import { isDimmed, isWinner } from './grouping';
import './GameRow.css';

/** Left-hand status column: live period and clock, "Final", or tip-off time. */
function StatusCell({ game }: { game: Game }) {
  if (game.state.status === 'live') {
    const detail = game.state.clock
      ? `${game.state.periodLabel} ${game.state.clock}`
      : game.state.periodLabel;

    return (
      <div className="game-row__status game-row__status--live">
        <span className="game-row__live">
          <span className="game-row__live-dot" aria-hidden="true" />
          Live
        </span>
        <span className="game-row__detail">{detail}</span>
      </div>
    );
  }

  if (game.state.status === 'final') {
    return (
      <div className="game-row__status">
        <span className="game-row__detail">
          Final{game.state.wentToOvertime ? ' / OT' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="game-row__status">
      <span className="game-row__detail">{formatTipoff(game.startsAt)}</span>
    </div>
  );
}

interface TeamLineProps {
  team: TeamRef;
  score: number;
  showScore: boolean;
  won: boolean;
  dimmed: boolean;
}

function TeamLine({ team, score, showScore, won, dimmed }: TeamLineProps) {
  const modifier = won ? ' game-row__team--won' : dimmed ? ' game-row__team--lost' : '';

  return (
    <div className={`game-row__team${modifier}`}>
      <TeamLogo abbreviation={team.abbreviation} color={team.color} />
      <span className="game-row__name">{team.name}</span>
      {team.record ? <span className="game-row__record">{team.record}</span> : null}
      {showScore ? <span className="game-row__score">{score}</span> : null}
    </div>
  );
}

/** Accessible one-line summary, so the row reads sensibly to a screen reader. */
function summarize(game: Game): string {
  const teams = `${game.away.name} at ${game.home.name}`;

  switch (game.state.status) {
    case 'scheduled':
      return `${teams}, starts ${formatTipoff(game.startsAt)}`;
    case 'live': {
      const when = game.state.clock
        ? `${game.state.periodLabel} ${game.state.clock}`
        : game.state.periodLabel;
      return `${teams}, live, ${when}, ${game.awayScore} to ${game.homeScore}`;
    }
    case 'final':
      return `${teams}, final${game.state.wentToOvertime ? ' after overtime' : ''}, ${
        game.awayScore
      } to ${game.homeScore}`;
  }
}

export function GameRow({ game }: { game: Game }) {
  const showScores = game.state.status !== 'scheduled';

  return (
    <Link to={`/game/${game.id}`} className="game-row" aria-label={summarize(game)}>
      <StatusCell game={game} />
      <div className="game-row__teams">
        <TeamLine
          team={game.away}
          score={game.awayScore}
          showScore={showScores}
          won={isWinner(game, 'away')}
          dimmed={isDimmed(game, 'away')}
        />
        <TeamLine
          team={game.home}
          score={game.homeScore}
          showScore={showScores}
          won={isWinner(game, 'home')}
          dimmed={isDimmed(game, 'home')}
        />
      </div>
    </Link>
  );
}
