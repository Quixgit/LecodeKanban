const COOKIE = 'lk_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

export function readCsrfCookie(): string | null {
  const match = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`));
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
}

let pending: Promise<string> | null = null;

/** Returns the CSRF token, fetching one (once, shared) when the cookie is missing. */
export async function ensureCsrf(baseUrl: string): Promise<string> {
  const existing = readCsrfCookie();
  if (existing) return existing;
  pending ??= globalThis
    .fetch(`${baseUrl}/auth/csrf`, { credentials: 'include' })
    .then((r) => r.json() as Promise<{ token: string }>)
    .then((b) => readCsrfCookie() ?? b.token)
    .finally(() => {
      pending = null;
    });
  return pending;
}
