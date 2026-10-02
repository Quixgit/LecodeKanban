import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { Button, Tooltip } from '@/shared/ui';
import { authApi, oauthStartUrl } from '../api/authApi';

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="!size-[18px]">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="!size-[18px] fill-current">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

/** "Continue with Google / GitHub". Unconfigured providers render disabled with a tooltip. */
export function OAuthButtons({ next }: { next: string }) {
  const { t } = useTranslation('auth');
  const { language } = useLanguage();
  const { data } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: authApi.providers,
    staleTime: Infinity,
  });

  const providers = [
    {
      id: 'google' as const,
      label: t('oauth.google'),
      icon: <GoogleMark />,
      enabled: data?.google ?? false,
    },
    {
      id: 'github' as const,
      label: t('oauth.github'),
      icon: <GitHubMark />,
      enabled: data?.github ?? false,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {providers.map((p) => {
        const button = p.enabled ? (
          <Button asChild variant="secondary" size="lg" block>
            <a href={oauthStartUrl(p.id, next, language)}>
              {p.icon}
              {p.label}
            </a>
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            block
            disabled
            aria-describedby={`oauth-${p.id}-hint`}
          >
            {p.icon}
            {p.label}
          </Button>
        );
        return p.enabled ? (
          <div key={p.id}>{button}</div>
        ) : (
          <Tooltip key={p.id} content={t('oauth.notConfigured')}>
            <span tabIndex={0} className="block rounded-lg">
              {button}
              <span id={`oauth-${p.id}-hint`} className="sr-only">
                {t('oauth.notConfigured')}
              </span>
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function OrDivider() {
  const { t } = useTranslation('auth');
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-text-muted" role="separator">
      <span className="h-px flex-1 bg-border" />
      {t('oauth.divider')}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
