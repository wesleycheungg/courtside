import { LoadingState, Skeleton } from '../../components/Skeleton';
import './RosterSkeleton.css';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const STATS = [0, 1, 2, 3];

/** A roster is fetched separately from the game, so it loads separately. */
export function RosterSkeleton() {
  return (
    <LoadingState label="Loading roster">
      <ul className="roster-skeleton">
        {ROWS.map((row) => (
          <li className="roster-skeleton__row" key={row}>
            <Skeleton className="roster-skeleton__name" />
            {STATS.map((stat) => (
              <Skeleton className="roster-skeleton__stat" key={stat} />
            ))}
          </li>
        ))}
      </ul>
    </LoadingState>
  );
}
