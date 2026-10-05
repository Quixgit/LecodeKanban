import { Check, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { isHex } from '@/shared/lib/color';
import { Button, SettingsCard } from '@/shared/ui';
import type { WorkspaceSettings } from '../api/settingsApi';
import { useSaver } from '../hooks/useSaver';
import { ACCENTS, WORKSPACE_ICONS, type WorkspaceIcon } from '../model/workspaceLook';
import { WorkspaceGlyph } from './WorkspaceGlyph';

/** The workspace's icon and accent colour: shown in the header, buttons and highlights for every member. */
export function AppearanceCard({
  workspaceId,
  name,
  settings,
  canEdit,
}: {
  workspaceId: string;
  name: string;
  settings: WorkspaceSettings;
  canEdit: boolean;
}) {
  const { t } = useTranslation('settings');
  const { save } = useSaver(workspaceId);
  const custom = settings.accentColor && !ACCENTS.includes(settings.accentColor);
  return (
    <SettingsCard title={t('look.title')} description={t('look.description')}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-xl bg-surface-muted p-4">
          <WorkspaceGlyph icon={settings.icon} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-md font-semibold text-text">{name}</p>
            <p className="text-xs text-text-muted">{t('look.preview')}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text">{t('look.icon')}</p>
          <div role="radiogroup" aria-label={t('look.icon')} className="flex flex-wrap gap-2">
            {(Object.keys(WORKSPACE_ICONS) as WorkspaceIcon[]).map((key) => {
              const Icon = WORKSPACE_ICONS[key];
              const on = settings.icon === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={t(`look.icons.${key}`)}
                  disabled={!canEdit}
                  onClick={() => save({ icon: key })}
                  className={cn(
                    'grid size-11 place-items-center rounded-xl border outline-none transition-[border-color,background-color,transform] duration-micro focus-visible:shadow-focus active:scale-95 disabled:opacity-60',
                    on
                      ? 'border-primary bg-primary-subtle text-primary-ink'
                      : 'border-border text-text-muted hover:border-primary/40 hover:text-text',
                  )}
                >
                  <Icon className="size-5 stroke-[1.6]" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text">{t('look.accent')}</p>
          <div
            role="radiogroup"
            aria-label={t('look.accent')}
            className="flex flex-wrap items-center gap-2"
          >
            {ACCENTS.map((c) => {
              const on = settings.accentColor === c;
              return (
                <button
                  key={c || 'default'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c ? c.toUpperCase() : t('look.defaultAccent')}
                  disabled={!canEdit}
                  onClick={() => save({ accentColor: c })}
                  style={c ? { backgroundColor: c } : undefined}
                  className={cn(
                    'relative grid size-9 place-items-center rounded-full border-2 outline-none transition-[transform,box-shadow] duration-micro focus-visible:shadow-focus active:scale-90 disabled:opacity-60',
                    c ? 'text-white' : 'bg-primary-solid text-on-primary',
                    on ? 'border-text' : 'border-transparent hover:scale-110',
                  )}
                >
                  {on && <Check className="size-4" aria-hidden />}
                </button>
              );
            })}
            <label className="ml-2 flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="color"
                aria-label={t('look.custom')}
                disabled={!canEdit}
                value={isHex(settings.accentColor) ? settings.accentColor : ACCENTS[1]!}
                onChange={(e) => save({ accentColor: e.target.value })}
                className={cn(
                  'size-9 cursor-pointer rounded-full border-2 bg-transparent p-0.5',
                  custom ? 'border-text' : 'border-border',
                )}
              />
              {t('look.custom')}
            </label>
            {settings.accentColor && canEdit && (
              <Button variant="ghost" size="sm" onClick={() => save({ accentColor: '' })}>
                <RotateCcw />
                {t('look.reset')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
