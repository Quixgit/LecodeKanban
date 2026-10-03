import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth';
import { AppShell } from './layouts/app-shell/AppShell';
import type { RouteHandle } from './layouts/app-shell/header/PageTitle';
import { BootSplash } from './layouts/BootSplash';
import { AuthLayout } from './layouts/auth/AuthLayout';
import { RouteError } from './layouts/RouteError';

const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));
const ShowcasePage = lazy(() => import('@/pages/ShowcasePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ProjectsPage = lazy(() => import('@/pages/ProjectsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const DocsPage = lazy(() => import('@/pages/DocsPage'));
const DocsHomeRoute = lazy(() =>
  import('@/pages/docs/DocsRoutes').then((m) => ({ default: m.DocsHomeRoute })),
);
const DocsSpaceRoute = lazy(() =>
  import('@/pages/docs/DocsRoutes').then((m) => ({ default: m.DocsSpaceRoute })),
);
const DocsPageRoute = lazy(() =>
  import('@/pages/docs/DocsRoutes').then((m) => ({ default: m.DocsPageRoute })),
);
const DocsTrashRoute = lazy(() =>
  import('@/pages/docs/DocsRoutes').then((m) => ({ default: m.DocsTrashRoute })),
);
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const InvitePage = lazy(() => import('@/pages/InvitePage'));

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

const guest = (el: ReactNode) => <GuestOnly fallback={<BootSplash />}>{el}</GuestOnly>;

export const routes: RouteObject[] = [
  {
    element: <AuthLayout />,
    errorElement: <RouteError />,
    children: [
      { path: 'login', element: guest(<LoginPage />) },
      { path: 'register', element: guest(<RegisterPage />) },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'verify-email', element: <VerifyEmailPage /> },
      { path: 'invite/:token', element: <InvitePage /> },
    ],
  },
  {
    path: '/',
    errorElement: <RouteError />,
    element: (
      <RequireAuth fallback={<BootSplash />}>
        <AppShell />
      </RequireAuth>
    ),
    // Pathless wrapper: a failing page shows the error inside the shell (sidebar and header stay usable).
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, handle: page('dashboard'), element: <DashboardPage /> },
          { path: 'projects', handle: page('projects'), element: <ProjectsPage /> },
          { path: 'calendar', handle: page('calendar'), element: <CalendarPage /> },
          { path: 'tasks', handle: page('tasks'), element: <TasksPage /> },
          { path: 'tasks/:status', handle: page('tasks'), element: <TasksPage /> },
          {
            path: 'docs',
            handle: page('docs'),
            element: <DocsPage />,
            children: [
              { index: true, element: <DocsHomeRoute /> },
              { path: 's/:spaceId', element: <DocsSpaceRoute /> },
              { path: 'p/:nodeId', element: <DocsPageRoute /> },
              { path: 'trash', element: <DocsTrashRoute /> },
            ],
          },
          upcoming('performance', 'performance'),
          upcoming('help', 'help'),
          { path: 'team', handle: page('team'), element: <TeamPage /> },
          upcoming('integrations', 'integrations'),
          upcoming('settings', 'settings'),
          upcoming('settings/profile', 'settings'),
          { path: 'ui-kit', handle: page('uiKit'), element: <ShowcasePage /> },
          { path: '*', handle: page('notFound'), element: <NotFoundPage /> },
        ],
      },
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
