/** Decorative chevron for the date picker. Each button carries its own label. */

const PATHS = {
  left: 'M15 5 8 12l7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M5 9l7 7 7-7',
} as const;

interface ChevronProps {
  direction: keyof typeof PATHS;
  className?: string;
}

export function Chevron({ direction, className }: ChevronProps) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
      focusable={false}
      className={className}
    >
      <path d={PATHS[direction]} />
    </svg>
  );
}
