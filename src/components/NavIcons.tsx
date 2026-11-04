/** Bottom-nav glyphs. Decorative — each nav item is labelled by its own text. */

interface IconProps {
  className?: string;
}

const common = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export function GamesIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
      <path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" />
    </svg>
  );
}

/** Ranked bars on a baseline — a standings table, highest seed first. */
export function StandingsIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="M3.5 20h17" />
      <rect x="4.75" y="7.5" width="3.5" height="12.5" />
      <rect x="10.25" y="11" width="3.5" height="9" />
      <rect x="15.75" y="14.5" width="3.5" height="5.5" />
    </svg>
  );
}

export function FollowingIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9L3.5 9.7l5.9-.8L12 3.5Z" />
    </svg>
  );
}

export function NewsIcon({ className }: IconProps) {
  return (
    <svg {...common} className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M7 9h10M7 12.5h10M7 16h6" />
    </svg>
  );
}
