import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json } from '@/test/render';
import { api, onSessionExpired, unwrap } from './client';
import { ApiError } from './errors';

const calls: { url: string; method: string; csrf: string | null; body: string | null }[] = [];

function mockFetch(handler: (url: string, req: Request) => Response | Promise<Response>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const req =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://app.test'), init);
      const body = req.method === 'GET' ? null : await req.clone().text();
      calls.push({
        url: new URL(req.url).pathname,
        method: req.method,
        csrf: req.headers.get('X-CSRF-Token'),
        body,
      });
      return handler(new URL(req.url).pathname, req);
    }),
  );
}

beforeEach(() => {
  calls.length = 0;
  document.cookie = 'lk_csrf=tok-1; path=/';
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = 'lk_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
});

describe('api client', () => {
  it('sends the CSRF header on unsafe methods only', async () => {
    mockFetch(() => json(200, []));
    await unwrap(api.GET('/workspaces'));
    await unwrap(api.POST('/workspaces', { body: { name: 'X' } })).catch(() => undefined);
    expect(calls[0]).toMatchObject({ method: 'GET', csrf: null });
    expect(calls[1]).toMatchObject({ method: 'POST', csrf: 'tok-1' });
  });

  it('refreshes once on 401 and replays the original request with its body', async () => {
    let authed = false;
    mockFetch((url) => {
      if (url.endsWith('/auth/refresh')) {
        authed = true;
        return json(200, { user: {} });
      }
      return authed
        ? json(201, { id: 'w1' })
        : json(401, { error: { code: 'common.unauthorized', message: '' } });
    });
    const [a, b] = await Promise.all([
      unwrap(api.POST('/workspaces', { body: { name: 'Core' } })),
      unwrap(api.GET('/workspaces')),
    ]);
    expect(a).toEqual({ id: 'w1' });
    expect(b).toEqual({ id: 'w1' });
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    const replay = calls.filter((c) => c.method === 'POST' && c.url.endsWith('/workspaces')).at(-1);
    expect(replay?.body).toBe('{"name":"Core"}');
  });

  it('reports session expiry when refresh fails and surfaces the API error code', async () => {
    mockFetch((url) =>
      url.endsWith('/auth/refresh')
        ? json(401, { error: { code: 'auth.session_expired', message: '' } })
        : json(401, { error: { code: 'common.unauthorized', message: 'auth required' } }),
    );
    const expired = vi.fn();
    const off = onSessionExpired(expired);
    const err = await unwrap(api.GET('/users/me')).catch((e: unknown) => e);
    off();
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('common.unauthorized');
    expect(expired).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh for login failures', async () => {
    mockFetch(() => json(401, { error: { code: 'auth.invalid_credentials', message: '' } }));
    const err = (await unwrap(
      api.POST('/auth/login', { body: { email: 'a', password: 'b' } }),
    ).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('auth.invalid_credentials');
    expect(calls.some((c) => c.url.endsWith('/auth/refresh'))).toBe(false);
  });

  it('maps network failures to common.network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    const err = (await unwrap(api.GET('/workspaces')).catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('common.network');
  });
});
