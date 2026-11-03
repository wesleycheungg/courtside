import type { GameDetail, PlayEvent } from '../../data/types';
import { PlaysSkeleton } from './PlaysSkeleton';
import { usePlayByPlay } from './useGameDetail';
import './PlaysTab.css';

function teamNameFor(game: GameDetail, teamId: string | undefined): string | null {
  if (!teamId) return null;
  if (teamId === game.away.id) return game.away.name;
  if (teamId === game.home.id) return game.home.name;
  return null;
}

function PlayRow({ play, game }: { play: PlayEvent; game: GameDetail }) {
  const team = teamNameFor(game, play.teamId);

  return (
    <li className="plays__row">
      <span className="plays__clock">{play.clock}</span>
      <div className="plays__detail">
        <p className={`plays__text${play.isScoringPlay ? ' plays__text--scoring' : ''}`}>
          {play.description}
        </p>
        {team ? <p className="plays__team">{team}</p> : null}
      </div>
      <span className="plays__score">
        {play.awayScore}-{play.homeScore}
      </span>
    </li>
  );
}

export function PlaysTab({ game, active }: { game: GameDetail; active: boolean }) {
  const { data, isPending, isError, error } = usePlayByPlay(game.id, {
    enabled: active,
    isLive: game.state.status === 'live',
  });

  if (isPending) {
    return <PlaysSkeleton />;
  }

  if (isError) {
    return (
      <p className="panel__empty" role="alert">
        Could not load plays. {error.message}
      </p>
    );
  }

  if (data.length === 0) {
    return <p className="panel__empty">No plays yet.</p>;
  }

  return (
    <section className="panel">
      <h2 className="visually-hidden">Play by play</h2>
      <ul className="plays">
        {data.map((play) => (
          <PlayRow key={play.id} play={play} game={game} />
        ))}
      </ul>
    </section>
  );
}
