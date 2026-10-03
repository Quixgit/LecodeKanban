import { Plug } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Drawer, EmptyState, Skeleton, toast } from '@/shared/ui';
import type { IntegrationEntry, Provider } from '../api/integrationsApi';
import { useGithub } from '../hooks/useGithub';
import { useIntegrations } from '../hooks/useIntegrations';
import { GithubSettings } from './GithubSettings';
import { GithubTile } from './GithubTile';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { GoogleTile } from './IntegrationTile';
import { SetupGuide } from './SetupGuide';

/** The Integrations page: every connectable service as a card in a grid; settings open in a side panel. */
export function IntegrationsPage() {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const list = useIntegrations();
  const github = useGithub();
  const [params, setParams] = useSearchParams();
  const [settings, setSettings] = useState<Provider | 'github' | null>(null);
  const [setup, setSetup] = useState<Provider | null>(null);

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy>
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
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
  const items = list.data.items;
  const find = (p: Provider | null): IntegrationEntry | undefined =>
    items.find((i) => i.provider === p);
  const open = settings && settings !== 'github' ? find(settings) : undefined;
  const githubOpen = settings === 'github' ? github.data : undefined;
  const guide = find(setup);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((entry) => (
          <GoogleTile
            key={entry.provider}
            entry={entry}
            onSettings={() => setSettings(entry.provider)}
            onSetup={() => setSetup(entry.provider)}
          />
        ))}
        {github.data && (
          <GithubTile summary={github.data} onSettings={() => setSettings('github')} />
        )}
      </div>
      <Drawer
        open={!!open}
        onOpenChange={(o) => !o && setSettings(null)}
        width="md"
        title={open ? t(`${open.provider}.name`) : ''}
        description={open ? t(`${open.provider}.tagline`) : undefined}
      >
        {open?.provider === 'google_calendar' && (
          <GoogleCalendarSettings entry={open} leadChoices={list.data.leadChoices} />
        )}
      </Drawer>
      <Drawer
        open={!!githubOpen}
        onOpenChange={(o) => !o && setSettings(null)}
        width="md"
        title={t('github.name')}
        description={t('github.tagline')}
      >
        {githubOpen && <GithubSettings summary={githubOpen} />}
      </Drawer>
      {guide && <SetupGuide entry={guide} open onOpenChange={(o) => !o && setSetup(null)} />}
    </>
  );
}
