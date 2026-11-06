import { Link } from 'react-router-dom';
import type { GameDetail, StatLeader } from '../../data/types';
import { badgeBackground, barColor } from '../../lib/color';
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

/**
 * Played stats once the game tips off, season averages before it — the same
 * paired-bar panel either way, because the shape of the comparison does not
 * change, only what is being compared.
 */
function TeamStats({ game }: { game: GameDetail }) {
  if (game.teamStats.length === 0 && game.teamForm.length === 0) return null;

  const pregame = game.state.status === 'scheduled';
  const awayFill = barColor(game.away.color);
  const homeFill = barColor(game.home.color);
  const lastForm = game.teamForm.length - 1;

  return (
    <section className="panel">
      <h2 className="panel__title">{pregame ? 'Season Averages' : 'Team Stats'}</h2>
      <ul className="team-stats">
        {game.teamForm.map((line, index) => (
          <li
            className={
              index === lastForm
                ? 'team-stats__row team-stats__row--form team-stats__row--form-last'
                : 'team-stats__row team-stats__row--form'
            }
            key={line.label}
          >
            <span className="team-stats__value">{line.awayValue}</span>
            <span className="team-stats__label">{line.label}</span>
            <span className="team-stats__value team-stats__value--end">
              {line.homeValue}
            </span>
          </li>
        ))}
        {game.teamStats.map((stat) => (
          <li className="team-stats__row" key={stat.label}>
            <span className="team-stats__value">{stat.awayValue}</span>
            <span className="team-stats__label">{stat.label}</span>
            <span className="team-stats__value team-stats__value--end">
              {stat.homeValue}
            </span>
            <div className="team-stats__bar">
              <span
                className="team-stats__fill"
                style={{ width: `${stat.awayShare * 100}%`, backgroundColor: awayFill }}
              />
              <span
                className="team-stats__fill"
                style={{
                  width: `${(1 - stat.awayShare) * 100}%`,
                  backgroundColor: homeFill,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STAT_LABEL: Record<StatLeader['stat'], string> = {
  points: 'Points',
  rebounds: 'Rebounds',
  assists: 'Assists',
};

/** "Shai Gilgeous-Alexander" -> "SG". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Two leaders per stat, mirrored around the label. Every grid track is a fixed
 * width or a 1fr, never `auto` — an auto track would size to its own row's
 * label, so "Rebounds" and "Points" would push their rows' numbers to
 * different places and the column would visibly stagger.
 */
function GameLeaders({ game }: { game: GameDetail }) {
  if (game.statLeaders.length === 0) return null;

  return (
    <section className="panel">
      <h2 className="panel__title">Game Leaders</h2>
      <ul className="leaders">
        {game.statLeaders.map((leader) => (
          <li className="leaders__row" key={leader.stat}>
            <span className="leaders__stat">{STAT_LABEL[leader.stat]}</span>

            <span
              className="leaders__avatar leaders__avatar--away"
              style={{ backgroundColor: badgeBackground(game.away.color) }}
              aria-hidden="true"
            >
              {initials(leader.away.name)}
            </span>
            <span className="leaders__value leaders__value--away">
              {leader.away[leader.stat]}
            </span>
            <span className="leaders__name leaders__name--away">{leader.away.name}</span>

            <span
              className="leaders__avatar leaders__avatar--home"
              style={{ backgroundColor: badgeBackground(game.home.color) }}
              aria-hidden="true"
            >
              {initials(leader.home.name)}
            </span>
            <span className="leaders__value leaders__value--home">
              {leader.home[leader.stat]}
            </span>
            <span className="leaders__name leaders__name--home">{leader.home.name}</span>
          </li>
        ))}
      </ul>
      <p className="leaders__footer">
        <Link className="leaders__link" to="?tab=boxscore" replace>
          Full Box Score
        </Link>
      </p>
    </section>
  );
}

export function SummaryTab({ game }: { game: GameDetail }) {
  const empty =
    game.periods.length === 0 &&
    game.teamStats.length === 0 &&
    game.teamForm.length === 0 &&
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
