import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Card, Pill, Switch } from '@/shared/ui';
import type { ModuleView } from '../hooks/useModules';
import { STANDING_PILL } from './standingPill';

/** One module as a card: the whole card opens the module's own page; the Active switch stays reachable. */
export function IntegrationTile({ module: m }: { module: ModuleView }) {
  const { t } = useTranslation('integrations');
  const Icon = m.icon;
  return (
    <Card
      className="group relative flex h-full flex-col gap-4 p-5 transition-[border-color,box-shadow,transform] duration-ui ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:transform-none"
      data-provider={m.id}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink transition-transform duration-ui group-hover:scale-105">
          <Icon className="size-5.5 stroke-[1.6]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-text">
            <Link
              to={m.to}
              aria-label={m.name}
              className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:shadow-focus"
            >
              {m.name}
            </Link>
          </h2>
          <Pill
            tone={STANDING_PILL[m.where].tone}
            icon={STANDING_PILL[m.where].icon}
            size="sm"
            className="mt-1"
          >
            {t(`status.${m.where}`)}
          </Pill>
        </div>
        <ChevronRight
          className="mt-1 size-5 shrink-0 text-text-faint transition-transform duration-ui group-hover:translate-x-0.5 group-hover:text-primary-ink"
          aria-hidden
        />
      </div>
      <p className="flex-1 text-sm text-text-secondary">{m.tagline}</p>
      {m.account && <p className="truncate text-xs text-text-muted">{m.account}</p>}
      {m.note && <p className="text-xs text-text-muted">{m.note}</p>}
      <div className="relative z-10 flex items-center justify-between gap-3 border-t border-border-subtle pt-4">
        <label
          className={cn(
            'flex items-center gap-2.5',
            m.active.enabled ? 'cursor-pointer' : 'cursor-not-allowed',
          )}
        >
          <Switch
            checked={m.active.checked}
            disabled={!m.active.enabled}
            onCheckedChange={m.active.onChange}
            aria-label={m.active.label}
          />
          <span
            className={cn(
              'text-sm font-medium',
              m.active.enabled ? 'text-text' : 'text-text-muted',
            )}
          >
            {t('active.label')}
          </span>
        </label>
        <span className="text-sm font-medium text-primary-ink">{t('tile.open')}</span>
      </div>
    </Card>
  );
}
