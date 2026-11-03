import { Link, useParams } from 'react-router-dom';
import type { GameLogEntry, Player } from '../../data/types';
import { usePlayer } from './usePlayer';
import './PlayerPage.css';

function Header({ player }: { player: Player }) {
  return (
    <header className="player-header" style={{ backgroundColor: player.teamColor }}>
      <Link to="/" className="player-header__back" aria-label="Back to games">
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

      <div className="player-header__identity">
        <span className="player-header__jersey" aria-hidden="true">
          {player.jerseyNumber}
        </span>
        <div>
          <h1 className="player-header__name">{player.name}</h1>
          <p className="player-header__team">
            {player.teamName} · {player.position}
          </p>
          <p className="player-header__bio">
            {player.height} · {player.age} yrs · season {player.seasonNumber}
          </p>
        </div>
      </div>
    </header>
  );
}

function SeasonAverages({ player }: { player: Player }) {
  if (player.seasonAverages.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Season averages</h2>
      <ul className="tiles">
        {player.seasonAverages.map((tile) => (
          <li className="tiles__tile" key={tile.label}>
            <p className="tiles__value">{tile.value}</p>
            <p className="tiles__label">{tile.label}</p>
            {tile.rank ? <p className="tiles__rank">#{tile.rank} NBA</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bar chart of recent scoring. Oldest to newest, most recent highlighted. */
function RecentPoints({ log }: { log: GameLogEntry[] }) {
  if (log.length === 0) return null;

  const games = [...log].reverse();
  const peak = Math.max(...games.map((game) => game.points), 1);

  return (
    <section className="panel">
      <h2 className="panel__title">Points, last {games.length} games</h2>
      <ul className="spark">
        {games.map((game, index) => (
          <li className="spark__col" key={game.gameId}>
            <span className="spark__value">{game.points}</span>
            <span
              className={`spark__bar${index === games.length - 1 ? ' spark__bar--latest' : ''}`}
              style={{ height: `${Math.max(6, (game.points / peak) * 100)}%` }}
            />
            <span className="spark__label">
              {game.isHome ? '' : '@'}
              {game.opponentAbbreviation}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function resultTone(result: string): string {
  if (result.startsWith('W')) return 'player-log__result--win';
  if (result.startsWith('L')) return 'player-log__result--loss';
  return 'player-log__result--live';
}

function GameLog({ log }: { log: GameLogEntry[] }) {
  if (log.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Game log</h2>
      <div className="panel__scroll">
        <table className="player-log">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col">PTS</th>
              <th scope="col">REB</th>
              <th scope="col">AST</th>
              <th scope="col">FG</th>
            </tr>
          </thead>
          <tbody>
            {log.map((game) => (
              <tr key={game.gameId}>
                <th scope="row" className="player-log__game">
                  <span className="player-log__opponent">
                    {game.isHome ? 'vs' : '@'} {game.opponentAbbreviation}
                  </span>
                  <span className={`player-log__result ${resultTone(game.result)}`}>
                    {game.result}
                  </span>
                </th>
                <td className="player-log__points">{game.points}</td>
                <td>{game.rebounds}</td>
                <td>{game.assists}</td>
                <td>
                  {game.fieldGoalsMade}-{game.fieldGoalsAttempted}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Shooting({ player }: { player: Player }) {
  if (player.shootingSplits.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Shooting</h2>
      <ul className="splits">
        {player.shootingSplits.map((split) => (
          <li className="splits__row" key={split.label}>
            <span className="splits__label">{split.label}</span>
            <span className="splits__value">
              {split.percent}%{' '}
              <span className="splits__made">
                {split.made}/{split.attempted}
              </span>
            </span>
            <span className="splits__track">
              <span className="splits__fill" style={{ width: `${split.percent}%` }} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PlayerPage() {
  const { playerId = '' } = useParams();
  const { data: player, isPending, isError, error } = usePlayer(playerId);

  if (isPending) {
    return (
      <p className="panel__empty" role="status">
        Loading player…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="player-page__failure">
        <p className="panel__empty" role="alert">
          Could not load this player. {error.message}
        </p>
        <p className="player-page__back-link">
          <Link to="/">Back to games</Link>
        </p>
      </div>
    );
  }

  return (
    <article>
      <Header player={player} />
      <div className="player-page__body">
        <SeasonAverages player={player} />
        <RecentPoints log={player.gameLog} />
        <GameLog log={player.gameLog} />
        <Shooting player={player} />
      </div>
    </article>
  );
}
