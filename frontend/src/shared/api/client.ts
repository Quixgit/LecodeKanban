import createClient, { type Middleware } from 'openapi-fetch';
import { env } from '../config/env';
import { CSRF_HEADER, ensureCsrf } from './csrf';
import { NETWORK_ERROR, ApiError, toApiError } from './errors';
import type { paths } from './schema.gen';

// Absolute URL: identical in the browser (same origin) and resolvable by fetch/Request in tests.
const baseUrl = new URL(
  `${env.apiBaseUrl.replace(/\/$/, '')}/v1`,
  globalThis.location?.origin ?? 'http://localhost',
).toString();
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Endpoints where a 401 is a real answer, not an expired access token. */
const NO_REFRESH = [
  '/auth/login',
  '/auth/login/two-factor',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/session',
];

type SessionListener = () => void;
const expiredListeners = new Set<SessionListener>();

/** Subscribe to "refresh failed — the user is signed out". */
export function onSessionExpired(fn: SessionListener): () => void {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
}

let refreshing: Promise<boolean> | null = null;

/** Single-flight refresh: concurrent 401s share one /auth/refresh call. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const token = await ensureCsrf(baseUrl);
      const res = await globalThis.fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { [CSRF_HEADER]: token },
      });
      return res.ok;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Untouched copies of outgoing requests, so a 401 can be replayed after refresh (bodies are single-use). */
const replays = new WeakMap<Request, Request>();
const retried = new WeakSet<Request>();

const sessionMiddleware: Middleware = {
  async onRequest({ request }) {
    if (UNSAFE.has(request.method)) request.headers.set(CSRF_HEADER, await ensureCsrf(baseUrl));
    replays.set(request, request.clone());
    return request;
  },
  async onResponse({ request, response, schemaPath }) {
    const replay = replays.get(request);
    if (
      response.status !== 401 ||
      NO_REFRESH.includes(schemaPath) ||
      retried.has(request) ||
      !replay
    )
      return response;
    if (!(await refreshSession())) {
      expiredListeners.forEach((fn) => fn());
      return response;
    }
    // Refresh may have rotated nothing CSRF-wise, but re-read in case the cookie was re-issued.
    if (UNSAFE.has(replay.method)) replay.headers.set(CSRF_HEADER, await ensureCsrf(baseUrl));
    retried.add(replay);
    return globalThis.fetch(replay);
  },
};

// fetch is resolved per call (not captured at import) so polyfills and test doubles apply.
export const api = createClient<paths>({
  baseUrl,
  credentials: 'include',
  fetch: (req) => globalThis.fetch(req),
});
api.use(sessionMiddleware);

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Unwraps an openapi-fetch result: returns data or throws ApiError. */
export async function unwrap<T>(p: Promise<Result<T>>): Promise<T> {
  let res: Result<T>;
  try {
    res = await p;
  } catch (e) {
    throw new ApiError(0, NETWORK_ERROR, e instanceof Error ? e.message : 'network error');
  }
  if (res.error !== undefined || !res.response.ok) throw toApiError(res.response.status, res.error);
  return res.data as T;
}

export { baseUrl as apiBaseUrl };
