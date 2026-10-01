import { api, isApiError, unwrap, type Locale, type User } from '@/shared/api';

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
  locale?: Locale;
}

/** Current session user, or null when signed out. */
export async function fetchSession(): Promise<User | null> {
  try {
    const { user } = await unwrap(api.GET('/auth/session'));
    return user;
  } catch (e) {
    if (isApiError(e) && e.status === 401) {
      // The access token may simply have expired: try one silent refresh.
      try {
        const { user } = await unwrap(api.POST('/auth/refresh'));
        return user;
      } catch {
        return null;
      }
    }
    throw e;
  }
}

export const authApi = {
  login: (body: Credentials) => unwrap(api.POST('/auth/login', { body })).then((s) => s.user),
  register: (body: Registration) =>
    unwrap(api.POST('/auth/register', { body })).then((s) => s.user),
  logout: () => unwrap(api.POST('/auth/logout')),
  providers: () => unwrap(api.GET('/auth/providers')),
  forgot: (email: string) => unwrap(api.POST('/auth/password/forgot', { body: { email } })),
  reset: (token: string, password: string) =>
    unwrap(api.POST('/auth/password/reset', { body: { token, password } })),
  verify: (token: string) => unwrap(api.POST('/auth/verify-email', { body: { token } })),
  resendVerification: () => unwrap(api.POST('/auth/verify-email/resend')),
  updateProfile: (body: { name?: string; locale?: Locale }) =>
    unwrap(api.PATCH('/users/me', { body })),
};

/** Full-page navigation to the provider (cookies are set on the way back). */
export function oauthStartUrl(provider: 'google' | 'github', next: string, locale: string): string {
  const q = new URLSearchParams({ next, locale });
  return `/api/v1/auth/oauth/${provider}/start?${q.toString()}`;
}
