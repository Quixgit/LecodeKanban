import { Check, Settings2, TriangleAlert, Unplug, Wrench, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Button, Card, Pill, Switch, toast } from '@/shared/ui';
import type { IntegrationEntry } from '../api/integrationsApi';
import { useIntegrationMutations } from '../hooks/useIntegrations';
import { PROVIDERS, standing, type Standing } from '../model/providers';

const PILL: Record<Standing, { tone: 'neutral' | 'teal' | 'red' | 'amber'; icon: ReactNode }> = {
  needsSetup: { tone: 'amber', icon: <Wrench /> },
  off: { tone: 'neutral', icon: <Unplug /> },
  reconnect: { tone: 'red', icon: <TriangleAlert /> },
  paused: { tone: 'neutral', icon: <Unplug /> },
  active: { tone: 'teal', icon: <Check /> },
};

/** What every integration card shows; each provider fills it in. */
export interface TileProps {
  id: string;
  icon: LucideIcon;
  name: string;
  tagline: string;
  where: Standing;
  /** The connected account, when there is one. */
  account?: string;
  /** The Active switch: absent controls are shown off and disabled. */
  active: { checked: boolean; enabled: boolean; label: string; onChange: (on: boolean) => void };
  /** The one button: set up, connect, reconnect or settings. */
  action: { label: string; primary: boolean; icon: 'settings' | 'wrench'; onClick: () => void };
  note?: string;
}

/** One connectable service as a compact card: what it is, where it stands, the switch and the way in. */
export function TileFrame({ t }: { t: TileProps }) {
  const { t: tr } = useTranslation('integrations');
  const Icon = t.icon;
  return (
    <Card className="flex h-full flex-col gap-4 p-5" data-provider={t.id}>
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink">
          <Icon className="size-5.5 stroke-[1.6]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-text">{t.name}</h2>
          <Pill tone={PILL[t.where].tone} icon={PILL[t.where].icon} size="sm" className="mt-1">
            {tr(`status.${t.where}`)}
          </Pill>
        </div>
      </div>
      <p className="flex-1 text-sm text-text-secondary">{t.tagline}</p>
      {t.account && <p className="truncate text-xs text-text-muted">{t.account}</p>}
      {t.note && <p className="text-xs text-text-muted">{t.note}</p>}
      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <label
          className={cn(
            'flex items-center gap-2.5',
            t.active.enabled ? 'cursor-pointer' : 'cursor-not-allowed',
          )}
        >
          <Switch
            checked={t.active.checked}
            disabled={!t.active.enabled}
            onCheckedChange={t.active.onChange}
            aria-label={t.active.label}
          />
          <span
            className={cn(
              'text-sm font-medium',
              t.active.enabled ? 'text-text' : 'text-text-muted',
            )}
          >
            {tr('active.label')}
          </span>
        </label>
        <Button
          size="sm"
          variant={t.action.primary ? 'primary' : 'secondary'}
          onClick={t.action.onClick}
        >
          {t.action.icon === 'wrench' ? <Wrench /> : <Settings2 />}
          {t.action.label}
        </Button>
      </div>
    </Card>
  );
}

/** Google Calendar's card. */
export function GoogleTile({
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
  const where = standing(entry);
  const name = t(`${entry.provider}.name`);
  const switchable = where === 'active' || where === 'paused';
  return (
    <TileFrame
      t={{
        id: entry.provider,
        icon: PROVIDERS[entry.provider].icon,
        name,
        tagline: t(`${entry.provider}.tagline`),
        where,
        account:
          entry.connected && entry.accountEmail
            ? t('account', { email: entry.accountEmail })
            : undefined,
        active: {
          checked: where === 'active',
          enabled: switchable,
          label: t('active.aria', { name }),
          onChange: (enabled) =>
            m.update.mutate(
              { provider: entry.provider, patch: { enabled } },
              { onError: (e) => toast.error(errorText(e)) },
            ),
        },
        action:
          where === 'needsSetup'
            ? { label: t('tile.setup'), primary: false, icon: 'wrench', onClick: onSetup }
            : {
                label:
                  where === 'off'
                    ? t('tile.connect')
                    : where === 'reconnect'
                      ? t('reconnect')
                      : t('tile.settings'),
                primary: where === 'off' || where === 'reconnect',
                icon: 'settings',
                onClick: onSettings,
              },
      }}
    />
  );
}
