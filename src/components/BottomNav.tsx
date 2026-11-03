import { NavLink } from 'react-router-dom';
import { FollowingIcon, GamesIcon, LeaguesIcon, NewsIcon } from './NavIcons';
import './BottomNav.css';

interface NavItem {
  to: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactElement;
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Games', Icon: GamesIcon },
  { to: '/leagues', label: 'Leagues', Icon: LeaguesIcon },
  { to: '/following', label: 'Following', Icon: FollowingIcon },
  { to: '/news', label: 'News', Icon: NewsIcon },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul className="bottom-nav__list">
        {ITEMS.map(({ to, label, Icon }) => (
          <li key={to} className="bottom-nav__item">
            {/* NavLink sets aria-current="page" on the active link, so the
                current section is announced rather than only colored. */}
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                isActive
                  ? 'bottom-nav__link bottom-nav__link--active'
                  : 'bottom-nav__link'
              }
            >
              <Icon className="bottom-nav__icon" />
              <span className="bottom-nav__label">{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
