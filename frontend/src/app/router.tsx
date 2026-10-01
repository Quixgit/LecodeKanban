import { lazy } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { AppShell } from './layouts/app-shell/AppShell';
import type { RouteHandle } from './layouts/app-shell/header/PageTitle';

const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));
const ShowcasePage = lazy(() => import('@/pages/ShowcasePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const page = (key: string): RouteHandle => ({
  titleKey: `pages.${key}.title`,
  subtitleKey: `pages.${key}.subtitle`,
});

/** Sections whose feature modules ship in later phases render a shared placeholder. */
const upcoming = (path: string, key: string, index = false): RouteObject => ({
  ...(index ? { index: true } : { path }),
  handle: page(key),
  element: <ComingSoonPage section={key} />,
});

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      upcoming('', 'dashboard', true),
      upcoming('projects', 'projects'),
      upcoming('calendar', 'calendar'),
      upcoming('tasks', 'tasks'),
      upcoming('tasks/:status', 'tasks'),
      upcoming('performance', 'performance'),
      upcoming('help', 'help'),
      upcoming('team', 'team'),
      upcoming('integrations', 'integrations'),
      upcoming('settings', 'settings'),
      upcoming('settings/profile', 'settings'),
      { path: 'ui-kit', handle: page('uiKit'), element: <ShowcasePage /> },
      { path: '*', handle: page('notFound'), element: <NotFoundPage /> },
    ],
  },
];

export const createAppRouter = () =>
  createBrowserRouter(routes, {
    future: {
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  });
