import { LoadingState, Skeleton } from '../../components/Skeleton';
import './PlayerSkeleton.css';

const TILES = [0, 1, 2, 3];
const LOG_ROWS = [0, 1, 2, 3, 4];

/**
 * The player screen, before the profile arrives.
 *
 * The real header is painted in the player's team colour, which is not known
 * until the data lands — so the placeholder header stays neutral rather than
 * guessing a colour and flashing to another one.
 */
export function PlayerSkeleton() {
  return (
    <LoadingState label="Loading player" className="player-skeleton">
      <div className="player-skeleton__header">
        <Skeleton className="player-skeleton__back" />
        <div className="player-header__identity">
          <Skeleton className="player-skeleton__jersey" />
          <div className="player-skeleton__identity">
            <Skeleton className="player-skeleton__name" />
            <Skeleton className="player-skeleton__meta" />
          </div>
        </div>
      </div>

      <div className="player-page__body">
        <div className="panel">
          <Skeleton className="player-skeleton__panel-title" />
          <div className="tiles">
            {TILES.map((tile) => (
              <Skeleton className="player-skeleton__tile" key={tile} />
            ))}
          </div>
        </div>

        <div className="panel">
          <Skeleton className="player-skeleton__panel-title" />
          <Skeleton className="player-skeleton__chart" />
        </div>

        <div className="panel">
          <Skeleton className="player-skeleton__panel-title" />
          {LOG_ROWS.map((row) => (
            <Skeleton className="player-skeleton__log-row" key={row} />
          ))}
        </div>
      </div>
    </LoadingState>
  );
}
