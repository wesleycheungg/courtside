import type { GameDetail } from '../../data/types';
import { TeamLogo } from '../../components/TeamLogo';
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
              <th scope="col">T</th>
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
      <h2 className="panel__title">Team stats</h2>
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

function TopPerformers({ game }: { game: GameDetail }) {
  if (game.topPerformers.length === 0) return null;

  const teamOf = (playerId: string) =>
    game.boxScore.home.some((line) => line.playerId === playerId) ? game.home : game.away;

  return (
    <section className="panel">
      <h2 className="panel__title">Top performers</h2>
      <ul className="performers">
        {game.topPerformers.map((line) => {
          const team = teamOf(line.playerId);
          return (
            <li className="performers__row" key={line.playerId}>
              <TeamLogo abbreviation={team.abbreviation} color={team.color} />
              <div className="performers__who">
                <p className="performers__name">{line.name}</p>
                <p className="performers__meta">
                  {team.abbreviation} · {line.position}
                </p>
              </div>
              <p className="performers__line">
                <span>{line.points}</span>
                <span aria-hidden="true"> · </span>
                <span>{line.rebounds}</span>
                <span aria-hidden="true"> · </span>
                <span>{line.assists}</span>
                <span className="visually-hidden"> points, rebounds, assists</span>
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function SummaryTab({ game }: { game: GameDetail }) {
  const empty =
    game.periods.length === 0 &&
    game.teamStats.length === 0 &&
    game.topPerformers.length === 0;

  if (empty) {
    return <p className="panel__empty">Stats appear once the game tips off.</p>;
  }

  return (
    <>
      <Linescore game={game} />
      <TeamStats game={game} />
      <TopPerformers game={game} />
    </>
  );
}
