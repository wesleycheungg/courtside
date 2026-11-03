import { LoadingState, Skeleton } from '../../components/Skeleton';
import './GameRow.css';
import './LeagueSection.css';
import './FeedSkeleton.css';

/** A typical slate. Enough rows to fill a phone screen, not so many it scrolls. */
const ROWS = [0, 1, 2, 3, 4];

/**
 * The feed, before it has anything in it.
 *
 * Built out of the real `league-section` and `game-row` classes rather than
 * approximations of them, so the placeholder occupies the box the content will
 * and arriving games shift nothing.
 */
export function FeedSkeleton() {
  return (
    <LoadingState label="Loading games" className="games__feed">
      <div className="league-section">
        <div className="league-section__header">
          <Skeleton className="feed-skeleton__badge" />
          <Skeleton className="feed-skeleton__league" />
        </div>

        <ul className="league-section__games">
          {ROWS.map((row) => (
            <li key={row}>
              <div className="game-row">
                <div className="game-row__status">
                  <Skeleton className="feed-skeleton__status" />
                </div>
                <div className="game-row__teams">
                  <div className="game-row__team">
                    <Skeleton className="feed-skeleton__logo" />
                    <Skeleton className="feed-skeleton__name" />
                    <Skeleton className="feed-skeleton__score" />
                  </div>
                  <div className="game-row__team">
                    <Skeleton className="feed-skeleton__logo" />
                    <Skeleton className="feed-skeleton__name" />
                    <Skeleton className="feed-skeleton__score" />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </LoadingState>
  );
}
