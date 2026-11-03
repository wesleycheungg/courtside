import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';
import './AppShell.css';

/** Frame shared by every route: scrollable main content above a fixed nav. */
export function AppShell() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <main id="main" className="app-shell__main">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
