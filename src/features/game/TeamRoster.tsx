import { Link } from 'react-router-dom';
import type { RosterEntry, TeamRef } from '../../data/types';
import { abbreviateName, formatAverage } from './formatStats';
import { RosterSkeleton } from './RosterSkeleton';
import { useTeamRoster } from './useGameDetail';

function RosterTable({ entries }: { entries: RosterEntry[] }) {
  return (
    <div className="panel__scroll">
      <table className="box-score roster">
        {/* Says out loud that these are season numbers, not game numbers. */}
        <caption className="roster__caption">Season averages</caption>
        <thead>
          <tr>
            <th scope="col">
              <abbr title="Jersey number">#</abbr>
            </th>
            <th scope="col">Player</th>
            <th scope="col">
              <abbr title="Position">POS</abbr>
            </th>
            <th scope="col">PTS</th>
            <th scope="col">REB</th>
            <th scope="col">AST</th>
            <th scope="col">FG%</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.playerId}>
              <td className="box-score__jersey">{entry.jerseyNumber}</td>
              <th scope="row" className="box-score__player">
                <Link to={`/player/${entry.playerId}`}>{abbreviateName(entry.name)}</Link>
              </th>
              <td>{entry.position}</td>
              <td className="box-score__points">
                {formatAverage(entry.seasonAverages?.points)}
              </td>
              <td>{formatAverage(entry.seasonAverages?.rebounds)}</td>
              <td>{formatAverage(entry.seasonAverages?.assists)}</td>
              <td>{formatAverage(entry.seasonAverages?.fieldGoalPercent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The box score before tip-off: who is available, and how they have played so
 * far. Fetched here rather than with the game, so a finished game — which will
 * never render this — does not pay for two roster requests it cannot use.
 *
 * There is no fallback if the fetch fails. A pre-game summary carries no
 * roster at all, so the error state is the fallback.
 */
export function TeamRoster({ team }: { team: TeamRef }) {
  const { data, isPending, isError } = useTeamRoster(team.id, { enabled: true });

  if (isPending) return <RosterSkeleton />;

  if (isError) {
    return (
      <p className="panel__empty" role="alert">
        Could not load the {team.abbreviation} roster.
      </p>
    );
  }

  if (data.length === 0) {
    return <p className="panel__empty">No roster available yet.</p>;
  }

  return <RosterTable entries={data} />;
}
