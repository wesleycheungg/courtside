import type { RouteObject } from 'react-router-dom';
import { AppShell } from './AppShell';
import { GamesPage } from '../features/games/GamesPage';
import { LeaguesPage } from '../features/leagues/LeaguesPage';
import { FollowingPage } from '../features/following/FollowingPage';
import { NewsPage } from '../features/news/NewsPage';
import { NotFoundPage } from '../features/NotFoundPage';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <GamesPage /> },
      { path: 'leagues', element: <LeaguesPage /> },
      { path: 'following', element: <FollowingPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
