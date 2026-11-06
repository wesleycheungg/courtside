import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { GameDetail, PlayerStatLine } from '../../data/types';
import { abbreviateName, formatMinutes, formatPlusMinus } from './formatStats';
import { TeamRoster } from './TeamRoster';
import './BoxScoreTab.css';

function StatTable({ lines }: { lines: PlayerStatLine[] }) {
  if (lines.length === 0) {
    return <p className="panel__empty">No box score yet.</p>;
  }

  return (
    <div className="panel__scroll">
      <table className="box-score">
        <thead>
          <tr>
            <th scope="col">
              <abbr title="Jersey number">#</abbr>
            </th>
            <th scope="col">Player</th>
            <th scope="col">MIN</th>
            <th scope="col">PTS</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">FG</th>
            <th scope="col">
              <abbr title="Plus-minus">+/−</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.playerId}>
              <td className="box-score__jersey">{line.jerseyNumber}</td>
              <th scope="row" className="box-score__player">
                <Link to={`/player/${line.playerId}`}>{abbreviateName(line.name)}</Link>
              </th>
              <td>{formatMinutes(line.minutes)}</td>
              <td className="box-score__points">{line.points}</td>
              <td>{line.rebounds}</td>
              <td>{line.assists}</td>
              <td>
                {line.fieldGoalsMade}-{line.fieldGoalsAttempted}
              </td>
              <td>{formatPlusMinus(line.plusMinus)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BoxScoreTab({ game }: { game: GameDetail }) {
  const [side, setSide] = useState<'away' | 'home'>('home');
  // Before tip-off there is no box score to show, so the chips select a roster
  // instead. A live game with an empty box still wants StatTable's own copy.
  const isPregame = game.state.status === 'scheduled';

  return (
    <section className="panel">
      <div className="box-score__switch" role="group" aria-label="Choose a team">
        {(['away', 'home'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`box-score__chip${side === option ? ' box-score__chip--active' : ''}`}
            aria-pressed={side === option}
            onClick={() => setSide(option)}
          >
            {game[option].abbreviation}
          </button>
        ))}
      </div>

      {isPregame ? (
        <TeamRoster team={game[side]} />
      ) : (
        <StatTable lines={game.boxScore[side]} />
      )}
    </section>
  );
}
