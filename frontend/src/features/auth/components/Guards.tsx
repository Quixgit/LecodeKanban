import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../hooks/useSession';

/** Renders children only for signed-in users; otherwise redirects to /login?next=… */
export function RequireAuth({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <>{fallback}</>;
  if (!user) {
    const next = location.pathname + location.search;
    return (
      <Navigate to={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />
    );
  }
  return <>{children}</>;
}

/** Sends already signed-in users away from login/register. */
export function GuestOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const { user, isLoading } = useSession();
  const location = useLocation();
  if (isLoading) return <>{fallback}</>;
  if (user) {
    const next = new URLSearchParams(location.search).get('next');
    return (
      <Navigate to={next && next.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />
    );
  }
  return <>{children}</>;
}
