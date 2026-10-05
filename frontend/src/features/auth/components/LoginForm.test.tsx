import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, renderWithProviders } from '@/test/render';
import { LoginForm } from './LoginForm';

afterEach(() => vi.unstubAllGlobals());

function stub(handler: (url: string, body: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://app.test'), init);
      return handler(
        new URL(req.url).pathname,
        req.method === 'GET' ? '' : await req.clone().text(),
      );
    }),
  );
}

const providers = json(200, { google: false, github: true });

describe('LoginForm', () => {
  it('validates fields client-side before calling the API', async () => {
    const handler = vi.fn((url: string) =>
      url.endsWith('/auth/providers') ? providers.clone() : json(500),
    );
    stub(handler);
    renderWithProviders(<LoginForm />, { route: '/login', path: '/login' });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findAllByText('This field is required.')).toHaveLength(2);
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    expect(handler.mock.calls.every(([url]) => !url.endsWith('/auth/login'))).toBe(true);
  });

  it('shows the translated server error', async () => {
    document.cookie = 'lk_csrf=t; path=/';
    stub((url) =>
      url.endsWith('/auth/providers')
        ? providers.clone()
        : json(401, { error: { code: 'auth.invalid_credentials', message: 'x' } }),
    );
    renderWithProviders(<LoginForm />, { route: '/login', path: '/login' });
    await userEvent.type(screen.getByLabelText('Email'), 'peter@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Wrong-pass-1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('signs in and navigates to ?next', async () => {
    document.cookie = 'lk_csrf=t; path=/';
    let sent = '';
    stub((url, body) => {
      if (url.endsWith('/auth/providers')) return providers.clone();
      sent = body;
      return json(200, {
        user: { id: 'u1', name: 'Peter', email: 'peter@example.com', locale: 'en' },
      });
    });
    renderWithProviders(<LoginForm />, {
      route: '/login?next=%2Fteam',
      path: '/login',
      extraPaths: ['/team'],
    });
    await userEvent.type(screen.getByLabelText('Email'), 'peter@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Kanban-Board-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/team'));
    expect(JSON.parse(sent)).toEqual({ email: 'peter@example.com', password: 'Kanban-Board-2026' });
  });

  it('asks for the code after a correct password, then signs in', async () => {
    document.cookie = 'lk_csrf=t; path=/';
    let verified = '';
    stub((url, body) => {
      if (url.endsWith('/auth/providers')) return providers.clone();
      if (url.endsWith('/auth/login/two-factor')) {
        verified = body;
        return json(200, {
          user: { id: 'u1', name: 'Peter', email: 'peter@example.com', locale: 'en' },
        });
      }
      return json(401, {
        error: { code: 'auth.two_factor_required', message: 'x', meta: { token: 'tok-1' } },
      });
    });
    renderWithProviders(<LoginForm />, {
      route: '/login?next=%2Fteam',
      path: '/login',
      extraPaths: ['/team'],
    });
    await userEvent.type(screen.getByLabelText('Email'), 'peter@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'Kanban-Board-2026');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEvent.type(await screen.findByLabelText('Verification code'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/team'));
    expect(JSON.parse(verified)).toEqual({ token: 'tok-1', code: '123456' });
  });

  it('disables unconfigured OAuth providers and links configured ones', async () => {
    stub(() => providers.clone());
    renderWithProviders(<LoginForm />, { route: '/login?next=%2Ftasks', path: '/login' });
    expect(await screen.findByRole('link', { name: /Continue with GitHub/ })).toHaveAttribute(
      'href',
      '/api/v1/auth/oauth/github/start?next=%2Ftasks&locale=en',
    );
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeDisabled();
  });

  it('shows OAuth callback errors from ?error=', async () => {
    stub(() => providers.clone());
    renderWithProviders(<LoginForm />, {
      route: '/login?error=auth.oauth_email_unverified',
      path: '/login',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Your email isn't verified with that provider",
    );
  });
});
