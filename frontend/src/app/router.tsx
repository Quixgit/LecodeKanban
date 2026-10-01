import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/features/auth';
import { AppShell } from './layouts/app-shell/AppShell';
import type { RouteHandle } from './layouts/app-shell/header/PageTitle';
import { BootSplash } from './layouts/BootSplash';
import { AuthLayout } from './layouts/auth/AuthLayout';

const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));
const ShowcasePage = lazy(() => import('@/pages/ShowcasePage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const TeamPage = lazy(() => import('@/pages/TeamPage'));
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
    element: (
      <RequireAuth fallback={<BootSplash />}>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      upcoming('', 'dashboard', true),
      upcoming('projects', 'projects'),
      upcoming('calendar', 'calendar'),
      upcoming('tasks', 'tasks'),
      upcoming('tasks/:status', 'tasks'),
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
