import type { GameDetail } from '../../data/types';
import './SummaryTab.css';

function Linescore({ game }: { game: GameDetail }) {
  if (game.periods.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Linescore</h2>
      <div className="panel__scroll">
        <table className="quarters">
          <thead>
            <tr>
              <th scope="col">Team</th>
              {game.periods.map((period) => (
                <th scope="col" key={period.number}>
                  {period.label}
                </th>
              ))}
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {(['away', 'home'] as const).map((side) => (
              <tr key={side}>
                <th scope="row">{game[side].abbreviation}</th>
                {game.periods.map((period) => (
                  <td key={period.number}>
                    {side === 'away' ? period.awayScore : period.homeScore}
                  </td>
                ))}
                <td className="quarters__total">
                  {side === 'away' ? game.awayScore : game.homeScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamStats({ game }: { game: GameDetail }) {
  if (game.teamStats.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Team Stats</h2>
      <ul className="team-stats">
        {game.teamStats.map((stat) => (
          <li className="team-stats__row" key={stat.label}>
            <span className="team-stats__value">{stat.awayValue}</span>
            <span className="team-stats__label">{stat.label}</span>
            <span className="team-stats__value team-stats__value--end">
              {stat.homeValue}
            </span>
            <div className="team-stats__bar">
              <span
                className="team-stats__fill team-stats__fill--away"
                style={{ width: `${stat.awayShare * 100}%` }}
              />
              <span
                className="team-stats__fill team-stats__fill--home"
                style={{ width: `${(1 - stat.awayShare) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GameLeaders({ game }: { game: GameDetail }) {
  if (game.statLeaders.length === 0) return null;

  const statLabel = {
    points: 'Points',
    rebounds: 'Rebounds',
    assists: 'Assists',
  };

  const getStatValue = (line: typeof game.statLeaders[0]['away'], stat: typeof game.statLeaders[0]['stat']) => {
    if (stat === 'points') return line.points;
    if (stat === 'rebounds') return line.rebounds;
    if (stat === 'assists') return line.assists;
    return 0;
  };

  return (
    <section className="panel">
      <h2 className="panel__title">Game Leaders</h2>
      <div className="game-leaders">
        {game.statLeaders.map((leader) => (
          <div className="game-leaders__stat-row" key={leader.stat}>
            <div className="game-leaders__leader game-leaders__leader--away">
              <p className="game-leaders__value">{getStatValue(leader.away, leader.stat)}</p>
              <p className="game-leaders__player">
                {leader.away.name}
              </p>
            </div>
            <div className="game-leaders__stat-label">
              <p>{statLabel[leader.stat]}</p>
            </div>
            <div className="game-leaders__leader game-leaders__leader--home">
              <p className="game-leaders__value">{getStatValue(leader.home, leader.stat)}</p>
              <p className="game-leaders__player">
                {leader.home.name}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="game-leaders__footer">
        <a href="#box-score" className="game-leaders__link">
          Full Box Score
        </a>
      </div>
    </section>
  );
}

export function SummaryTab({ game }: { game: GameDetail }) {
  const empty =
    game.periods.length === 0 &&
    game.teamStats.length === 0 &&
    game.statLeaders.length === 0;

  if (empty) {
    return <p className="panel__empty">Stats appear once the game tips off.</p>;
  }

  return (
    <>
      <Linescore game={game} />
      <TeamStats game={game} />
      <GameLeaders game={game} />
    </>
  );
}
