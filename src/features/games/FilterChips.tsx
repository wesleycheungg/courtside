import type { FeedFilter } from './grouping';
import './FilterChips.css';

interface FilterChipsProps {
  value: FeedFilter;
  liveCount: number;
  onChange: (filter: FeedFilter) => void;
}

export function FilterChips({ value, liveCount, onChange }: FilterChipsProps) {
  const options: { id: FeedFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'live', label: liveCount > 0 ? `Live (${liveCount})` : 'Live' },
  ];

  return (
    <div className="filter-chips" role="group" aria-label="Filter games">
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`filter-chips__chip${
            value === id ? ' filter-chips__chip--active' : ''
          }`}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
