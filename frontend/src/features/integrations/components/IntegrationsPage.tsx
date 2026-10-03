import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, EmptyState, Skeleton, toast } from '@/shared/ui';
import { useIntegrations } from '../hooks/useIntegrations';
import { GoogleCalendarCard } from './GoogleCalendarCard';
import { Plug } from 'lucide-react';

/** The Integrations page: every connectable service, each as a card the person can switch on or off. */
export function IntegrationsPage() {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const list = useIntegrations();
  const [params, setParams] = useSearchParams();

  // Google sends the browser back here with the outcome in the address (announced once, even when
  // development mode runs the effect twice).
  const announced = useRef('');
  useEffect(() => {
    const connected = params.get('connected');
    const error = params.get('error');
    if (!connected && !error) return;
    if (announced.current === params.toString()) return;
    announced.current = params.toString();
    if (connected) toast.success(t('toast.connected'));
    else toast.error(t(error === 'denied' ? 'toast.denied' : 'toast.failed'));
    setParams({}, { replace: true });
  }, [params, setParams, t]);

  if (list.isPending) {
    return (
      <div className="flex max-w-4xl flex-col gap-4" aria-busy>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (list.isError) {
    return (
      <EmptyState
        icon={<Plug />}
        title={t('loadFailed')}
        description={errorText(list.error)}
        action={<Button onClick={() => void list.refetch()}>{t('retry')}</Button>}
      />
    );
  }
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      {list.data.items.map((entry) =>
        entry.provider === 'google_calendar' ? (
          <GoogleCalendarCard
            key={entry.provider}
            entry={entry}
            leadChoices={list.data.leadChoices}
          />
        ) : null,
      )}
    </div>
  );
}
