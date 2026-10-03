import { Check, Settings2, TriangleAlert, Unplug, Wrench } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, Card, Pill, Switch, toast } from '@/shared/ui';
import type { IntegrationEntry } from '../api/integrationsApi';
import { useIntegrationMutations } from '../hooks/useIntegrations';
import { PROVIDERS, standing, type Standing } from '../model/providers';

const PILL: Record<
  Standing,
  { tone: 'neutral' | 'teal' | 'red' | 'amber'; icon: React.ReactNode }
> = {
  needsSetup: { tone: 'amber', icon: <Wrench /> },
  off: { tone: 'neutral', icon: <Unplug /> },
  reconnect: { tone: 'red', icon: <TriangleAlert /> },
  paused: { tone: 'neutral', icon: <Unplug /> },
  active: { tone: 'teal', icon: <Check /> },
};

/** One connectable service as a compact card: what it is, where it stands, the switch and the way in. */
export function IntegrationTile({
  entry,
  onSettings,
  onSetup,
}: {
  entry: IntegrationEntry;
  onSettings: () => void;
  onSetup: () => void;
}) {
  const { t } = useTranslation('integrations');
  const errorText = useErrorText();
  const m = useIntegrationMutations();
  const Icon = PROVIDERS[entry.provider].icon;
  const where = standing(entry);
  const switchable = where === 'active' || where === 'paused';
  const name = t(`${entry.provider}.name`);

  return (
    <Card className="flex h-full flex-col gap-4 p-5" data-provider={entry.provider}>
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
          <Icon className="size-5.5 stroke-[1.6]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-text">{name}</h2>
          <Pill tone={PILL[where].tone} icon={PILL[where].icon} size="sm" className="mt-1">
            {t(`status.${where}`)}
          </Pill>
        </div>
      </div>
      <p className="flex-1 text-sm text-text-secondary">{t(`${entry.provider}.tagline`)}</p>
      {entry.connected && entry.accountEmail && (
        <p className="truncate text-xs text-text-muted">
          {t('account', { email: entry.accountEmail })}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <label
          className={
            switchable
              ? 'flex cursor-pointer items-center gap-2.5'
              : 'flex cursor-not-allowed items-center gap-2.5'
          }
        >
          <Switch
            checked={where === 'active'}
            disabled={!switchable}
            onCheckedChange={(enabled) =>
              m.update.mutate(
                { provider: entry.provider, patch: { enabled } },
                { onError: (e) => toast.error(errorText(e)) },
              )
            }
            aria-label={t('active.aria', { name })}
          />
          <span
            className={
              switchable ? 'text-sm font-medium text-text' : 'text-sm font-medium text-text-muted'
            }
          >
            {t('active.label')}
          </span>
        </label>
        {where === 'needsSetup' ? (
          <Button size="sm" variant="secondary" onClick={onSetup}>
            <Wrench />
            {t('tile.setup')}
          </Button>
        ) : (
          <Button
            size="sm"
            variant={where === 'off' || where === 'reconnect' ? 'primary' : 'secondary'}
            onClick={onSettings}
          >
            <Settings2 />
            {where === 'off'
              ? t('tile.connect')
              : where === 'reconnect'
                ? t('reconnect')
                : t('tile.settings')}
          </Button>
        )}
      </div>
    </Card>
  );
}
