import { LoadingState, Skeleton } from '../../components/Skeleton';
import './StandingsSkeleton.css';

/** Fifteen teams per conference, which is what the real table holds. */
const ROWS = Array.from({ length: 15 }, (_, index) => index);

/**
 * The standings table, before it has rows.
 *
 * The conference switch above it is already rendered by the time this shows,
 * so only the table is stood in for.
 */
export function StandingsSkeleton() {
  return (
    <LoadingState label="Loading standings" className="panel">
      <Skeleton className="standings-skeleton__head" />
      {ROWS.map((row) => (
        <div className="standings-skeleton__row" key={row}>
          <Skeleton className="standings-skeleton__seed" />
          <Skeleton className="standings-skeleton__logo" />
          <Skeleton className="standings-skeleton__team" />
          <Skeleton className="standings-skeleton__stat" />
        </div>
      ))}
    </LoadingState>
  );
}
