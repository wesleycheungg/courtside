import { Link } from 'react-router-dom';
import { TeamLogo } from '../../components/TeamLogo';
import type { GameDetail, TeamRef } from '../../data/types';
import { formatTipoff } from '../../lib/date';
import './GameHeader.css';

function TeamColumn({ team }: { team: TeamRef }) {
  return (
    <div className="game-header__team">
      <TeamLogo abbreviation={team.abbreviation} color={team.color} size="lg" />
      <p className="game-header__team-name">{team.name}</p>
      <p className="game-header__team-meta">{team.record}</p>
    </div>
  );
}

function StatusLine({ game }: { game: GameDetail }) {
  if (game.state.status === 'live') {
    return (
      <p className="game-header__status game-header__status--live">
        <span className="game-header__dot" aria-hidden="true" />
        {game.state.periodLabel}
        {game.state.clock ? ` · ${game.state.clock}` : ''}
      </p>
    );
  }

  if (game.state.status === 'final') {
    return (
      <p className="game-header__status">
        Final{game.state.wentToOvertime ? ' / OT' : ''}
      </p>
    );
  }

  return <p className="game-header__status">{formatTipoff(game.startsAt)}</p>;
}

export function GameHeader({ game }: { game: GameDetail }) {
  const showScores = game.state.status !== 'scheduled';

  return (
    <header className="game-header">
      <div className="game-header__bar">
        <Link to="/" className="game-header__back" aria-label="Back to games">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <p className="game-header__competition">NBA · Regular Season</p>
      </div>

      <div className="game-header__scoreline">
        <TeamColumn team={game.away} />

        <div className="game-header__score">
          {showScores ? (
            <p className="game-header__numbers">
              {/* aria-label is prohibited on a <p>, so the spoken form goes in
                  hidden text and the digits are hidden from the tree. */}
              <span className="visually-hidden">
                {game.away.name} {game.awayScore}, {game.home.name} {game.homeScore}
              </span>
              <span aria-hidden="true">{game.awayScore}</span>
              <span className="game-header__dash" aria-hidden="true">
                –
              </span>
              <span aria-hidden="true">{game.homeScore}</span>
            </p>
          ) : (
            <p className="game-header__numbers game-header__numbers--pending">vs</p>
          )}
          <StatusLine game={game} />
        </div>

        <TeamColumn team={game.home} />
      </div>
    </header>
  );
}
