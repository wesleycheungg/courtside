import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { GamesPage } from '../features/games/GamesPage';
import { GameDetailPage } from '../features/game/GameDetailPage';
import { PlayerPage } from '../features/player/PlayerPage';
import { LeaguesPage } from '../features/leagues/LeaguesPage';
import { HealthPage } from '../features/health/HealthPage';
import { FollowingPage } from '../features/following/FollowingPage';
import { NewsPage } from '../features/news/NewsPage';
import { NotFoundPage } from '../features/NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <GamesPage /> },
      { path: 'game/:gameId', element: <GameDetailPage /> },
      { path: 'player/:playerId', element: <PlayerPage /> },
      { path: 'leagues', element: <LeaguesPage /> },
      { path: 'following', element: <FollowingPage /> },
      { path: 'news', element: <NewsPage /> },
      // Not in the bottom nav: an operator's screen, not a tab a fan needs.
      { path: 'health', element: <HealthPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
