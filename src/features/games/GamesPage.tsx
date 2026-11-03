import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page } from '../../components/Page';
import { isDateKey, toDateKey } from '../../lib/date';
import { DateStrip } from './DateStrip';
import { FilterChips } from './FilterChips';
import { LeagueSection } from './LeagueSection';
import { applyFilter, countLive, groupByLeague, type FeedFilter } from './grouping';
import { useGames } from './useGames';
import './GamesPage.css';

/** The wordmark from the design: "COURT" in white, "SIDE" in accent. */
function Wordmark() {
  return (
    <span className="wordmark">
      Court<span className="wordmark__accent">side</span>
    </span>
  );
}

export function GamesPage() {
  const [params, setParams] = useSearchParams();

  // Today is read once per render rather than memoised: a tab left open past
  // midnight should start calling the new day "today".
  const today = toDateKey(new Date());

  const dateParam = params.get('date');
  const selectedDate = dateParam && isDateKey(dateParam) ? dateParam : today;

  const filterParam = params.get('filter');
  const filter: FeedFilter = filterParam === 'live' ? 'live' : 'all';

  const { data: games, isPending, isError, error } = useGames(selectedDate);

  const groups = useMemo(
    () => (games ? groupByLeague(applyFilter(games, filter)) : []),
    [games, filter],
  );

  /** Keeps the other params intact so date and filter compose in the URL. */
  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  }

  return (
    <Page title={<Wordmark />}>
      <DateStrip
        selected={selectedDate}
        today={today}
        onSelect={(date) => update('date', date === today ? null : date)}
      />

      <FilterChips
        value={filter}
        liveCount={countLive(games ?? [])}
        onChange={(next) => update('filter', next === 'all' ? null : next)}
      />

      <Feed
        isPending={isPending}
        isError={isError}
        error={error}
        groups={groups}
        filter={filter}
      />

      <p className="games__disclaimer">Sample data for demo purposes</p>
    </Page>
  );
}

interface FeedProps {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  groups: ReturnType<typeof groupByLeague>;
  filter: FeedFilter;
}

function Feed({ isPending, isError, error, groups, filter }: FeedProps) {
  if (isPending) {
    return (
      <p className="games__state" role="status">
        Loading games…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="games__state games__state--error" role="alert">
        Could not load games. {error?.message}
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <p className="games__state" role="status">
        {filter === 'live' ? 'No games are live right now.' : 'No games on this date.'}
      </p>
    );
  }

  return (
    <div className="games__feed">
      {groups.map((group) => (
        <LeagueSection key={group.league} group={group} />
      ))}
    </div>
  );
}
