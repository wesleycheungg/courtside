import { badgeBackground } from '../lib/color';
import './TeamLogo.css';

interface TeamLogoProps {
  abbreviation: string;
  color: string;
  size?: 'sm' | 'lg';
}

/**
 * Colored bubble with the team's abbreviation. Decorative — every usage sits
 * next to the team's name, so announcing the abbreviation too would just be
 * repetition.
 */
export function TeamLogo({ abbreviation, color, size = 'sm' }: TeamLogoProps) {
  return (
    <span
      className={`team-logo team-logo--${size}`}
      style={{ backgroundColor: badgeBackground(color) }}
      aria-hidden="true"
    >
      {abbreviation}
    </span>
  );
}
