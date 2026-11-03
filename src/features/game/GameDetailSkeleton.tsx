import { LoadingState, Skeleton } from '../../components/Skeleton';
import './GameDetailSkeleton.css';

const TABS = [0, 1, 2, 3];
const QUARTERS = [0, 1, 2, 3, 4];
const STATS = [0, 1, 2, 3];

/**
 * Game detail, before the summary arrives.
 *
 * Reuses the header, tab strip and panel classes, so the tabs land where they
 * will stay — they are sticky, and a tab strip that moves after load is the
 * worst version of this problem.
 */
export function GameDetailSkeleton() {
  return (
    <LoadingState label="Loading game" className="game-detail">
      <div className="game-header">
        <div className="game-header__bar">
          <Skeleton className="detail-skeleton__back" />
          <Skeleton className="detail-skeleton__competition" />
        </div>
        <div className="game-header__scoreline">
          <div className="game-header__team">
            <Skeleton className="detail-skeleton__logo" />
            <Skeleton className="detail-skeleton__team-name" />
            <Skeleton className="detail-skeleton__team-meta" />
          </div>
          <div className="game-header__score">
            <Skeleton className="detail-skeleton__numbers" />
            <Skeleton className="detail-skeleton__status" />
          </div>
          <div className="game-header__team">
            <Skeleton className="detail-skeleton__logo" />
            <Skeleton className="detail-skeleton__team-name" />
            <Skeleton className="detail-skeleton__team-meta" />
          </div>
        </div>
      </div>

      <div className="game-detail__tabs">
        {TABS.map((tab) => (
          <div className="game-detail__tab" key={tab}>
            <Skeleton className="detail-skeleton__tab" />
          </div>
        ))}
      </div>

      <div className="game-detail__panel">
        <div className="panel">
          <Skeleton className="detail-skeleton__panel-title" />
          <div className="detail-skeleton__quarters">
            {QUARTERS.map((quarter) => (
              <Skeleton className="detail-skeleton__quarter" key={quarter} />
            ))}
          </div>
        </div>

        <div className="panel">
          <Skeleton className="detail-skeleton__panel-title" />
          {STATS.map((stat) => (
            <Skeleton className="detail-skeleton__stat" key={stat} />
          ))}
        </div>
      </div>
    </LoadingState>
  );
}
