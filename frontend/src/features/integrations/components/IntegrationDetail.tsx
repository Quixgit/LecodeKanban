import { ArrowLeft, Plug } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Card, EmptyState, Pill, Skeleton, Switch } from '@/shared/ui';
import { useModules } from '../hooks/useModules';
import { GithubSettings } from './GithubSettings';
import { GoogleCalendarSettings } from './GoogleCalendarSettings';
import { STANDING_PILL } from './standingPill';
import { SetupGuide } from './SetupGuide';

/** A module's own page: what it is and where it stands up top, its settings below. */
export function IntegrationDetail() {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const { provider } = useParams();
  const { modules, leadChoices, isPending, isError, error, refetch } = useModules();

  if (isPending) return <Skeleton className="h-96 rounded-xl" aria-busy />;
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
  const m = modules.find((x) => x.id === provider);
  if (!m) {
    return (
      <EmptyState
        icon={<Plug />}
        title={t('notFound')}
        action={
          <Button asChild>
            <Link to="/integrations">{t('back')}</Link>
          </Button>
        }
      />
    );
  }
  const Icon = m.icon;
  const pill = STANDING_PILL[m.where];
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link
        to="/integrations"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-text-secondary outline-none transition-colors hover:text-text focus-visible:shadow-focus"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('back')}
      </Link>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
          <Icon className="size-7 stroke-[1.5]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-text">{m.name}</h2>
          <p className="mt-0.5 text-sm text-text-secondary">{m.tagline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={pill.tone} icon={pill.icon} size="sm">
              {t(`status.${m.where}`)}
            </Pill>
          </div>
        </div>
        <label className="flex items-center gap-2.5">
          <Switch
            checked={m.active.checked}
            disabled={!m.active.enabled}
            onCheckedChange={m.active.onChange}
            aria-label={m.active.label}
          />
          <span className="text-sm font-medium text-text">{t('active.label')}</span>
        </label>
      </Card>
      <Card className="p-6">
        {m.google && m.where === 'needsSetup' && <SetupGuide entry={m.google} />}
        {m.google && m.where !== 'needsSetup' && (
          <GoogleCalendarSettings entry={m.google} leadChoices={leadChoices} />
        )}
        {m.github && <GithubSettings summary={m.github} />}
      </Card>
    </div>
  );
}
