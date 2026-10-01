import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onSessionExpired, type Locale, type User } from '@/shared/api';
import { useLanguage } from '@/shared/i18n';
import { authApi, fetchSession, type Credentials, type Registration } from '../api/authApi';

export const sessionKey = ['session'] as const;

export function useSession() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return { user: query.data ?? null, isLoading: query.isPending, error: query.error };
}

/** Clears cached data when the API reports that the session is gone. */
export function useSessionExpiryListener() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onSessionExpired(() => {
        qc.setQueryData(sessionKey, null);
      }),
    [qc],
  );
}

/** The profile language wins over the browser/stored choice once signed in. */
export function useApplyProfileLanguage(user: User | null) {
  const { language, setLanguage } = useLanguage();
  const locale = user?.locale;
  useEffect(() => {
    if (locale && locale !== language) void setLanguage(locale);
    // Only react to the profile value changing (e.g. after sign-in).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);
}

function useOnSignedIn() {
  const qc = useQueryClient();
  return (user: User) => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' });
    qc.setQueryData(sessionKey, user);
  };
}

export function useLogin() {
  const onSignedIn = useOnSignedIn();
  return useMutation({ mutationFn: (c: Credentials) => authApi.login(c), onSuccess: onSignedIn });
}

export function useRegister() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (r: Registration) => authApi.register(r),
    onSuccess: onSignedIn,
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      qc.clear();
      qc.setQueryData(sessionKey, null);
    },
  });
}

/** Persists the language to the profile (when signed in) and switches the UI. */
export function useChangeLanguage() {
  const qc = useQueryClient();
  const { setLanguage } = useLanguage();
  const { user } = useSession();
  return (lng: Locale) => {
    void setLanguage(lng);
    if (!user || user.locale === lng) return;
    qc.setQueryData<User | null>(sessionKey, (prev) => (prev ? { ...prev, locale: lng } : prev));
    authApi
      .updateProfile({ locale: lng })
      .catch(() => qc.invalidateQueries({ queryKey: sessionKey }));
  };
}
