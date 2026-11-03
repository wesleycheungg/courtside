import { LoadingState, Skeleton } from '../../components/Skeleton';
import './PlaysTab.css';
import './PlaysSkeleton.css';

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Play-by-play is fetched separately from the summary, so it loads separately. */
export function PlaysSkeleton() {
  return (
    <LoadingState label="Loading plays" className="panel">
      <ul className="plays">
        {ROWS.map((row) => (
          <li className="plays__row" key={row}>
            <Skeleton className="plays-skeleton__clock" />
            <Skeleton className="plays-skeleton__text" />
            <Skeleton className="plays-skeleton__score" />
          </li>
        ))}
      </ul>
    </LoadingState>
  );
}
