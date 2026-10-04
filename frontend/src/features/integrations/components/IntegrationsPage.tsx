import { Plug } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, EmptyState, Skeleton, toast } from '@/shared/ui';
import { useModules } from '../hooks/useModules';
import { IntegrationTile } from './IntegrationTile';

/** The Integrations page: every connectable service as a card; a card opens that module's own page. */
export function IntegrationsPage() {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const { modules, isPending, isError, error, refetch } = useModules();
  const [params, setParams] = useSearchParams();

  // Google sends the browser back here with the outcome in the address (announced once, even when
  // development mode runs the effect twice).
  const announced = useRef('');
  useEffect(() => {
    const connected = params.get('connected');
    const err = params.get('error');
    if (!connected && !err) return;
    if (announced.current === params.toString()) return;
    announced.current = params.toString();
    if (connected) toast.success(t('toast.connected'));
    else toast.error(t(err === 'denied' ? 'toast.denied' : 'toast.failed'));
    setParams({}, { replace: true });
  }, [params, setParams, t]);

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <EmptyState
        icon={<Plug />}
        title={t('loadFailed')}
        description={errorText(error)}
        action={<Button onClick={refetch}>{t('retry')}</Button>}
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {modules.map((m) => (
        <IntegrationTile key={m.id} module={m} />
      ))}
    </div>
  );
}
