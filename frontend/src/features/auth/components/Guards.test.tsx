import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createTestQueryClient, renderWithProviders } from '@/test/render';
import { sessionKey } from '../hooks/useSession';
import { GuestOnly, RequireAuth } from './Guards';

describe('route guards', () => {
  it('RequireAuth redirects anonymous users to /login with next', () => {
    const qc = createTestQueryClient();
    qc.setQueryData(sessionKey, null);
    renderWithProviders(
      <RequireAuth fallback={<p>loading</p>}>
        <p>secret</p>
      </RequireAuth>,
      { route: '/team?tab=invites', path: '/team', extraPaths: ['/login'], queryClient: qc },
    );
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent('/login');
  });

  it('RequireAuth renders children for signed-in users; GuestOnly bounces them', () => {
    const qc = createTestQueryClient();
    qc.setQueryData(sessionKey, { id: 'u1', name: 'P', email: 'p@x.co' });
    renderWithProviders(
      <RequireAuth fallback={null}>
        <p>secret</p>
      </RequireAuth>,
      { route: '/team', path: '/team', queryClient: qc },
    );
    expect(screen.getByText('secret')).toBeInTheDocument();
  });

  it('GuestOnly sends signed-in users to next', () => {
    const qc = createTestQueryClient();
    qc.setQueryData(sessionKey, { id: 'u1' });
    renderWithProviders(
      <GuestOnly fallback={null}>
        <p>login form</p>
      </GuestOnly>,
      {
        route: '/login?next=%2Fprojects',
        path: '/login',
        extraPaths: ['/projects'],
        queryClient: qc,
      },
    );
    expect(screen.getByTestId('route')).toHaveTextContent('/projects');
  });
});
