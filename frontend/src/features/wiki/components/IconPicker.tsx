import { ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Dropdown, DropdownContent, DropdownTrigger, Tooltip } from '@/shared/ui';
import { WIKI_ICON_KEYS, WIKI_ICONS } from '../model/icons';
import type { WikiNode } from '../model/tree';
import { NodeIcon } from './NodeIcon';

/** Page icon: click to choose one of the outline icons (or reset to the default). */
export function IconPicker({
  node,
  editable,
  onChange,
}: {
  node: Pick<WikiNode, 'icon' | 'kind'>;
  editable: boolean;
  onChange: (icon: string) => void;
}) {
  const { t } = useTranslation('wiki');
  const glyph = <NodeIcon node={node} className="!size-8 !text-text-secondary" />;
  if (!editable) return <span className="mt-1.5">{glyph}</span>;
  return (
    <Dropdown>
      <Tooltip content={t('icon.change')}>
        <DropdownTrigger asChild>
          <button
            type="button"
            aria-label={t('icon.change')}
            className="mt-1 flex size-11 items-center justify-center rounded-xl transition-colors duration-micro hover:bg-surface-sunken focus-visible:shadow-focus focus-visible:outline-none"
          >
            {glyph}
          </button>
        </DropdownTrigger>
      </Tooltip>
      <DropdownContent align="start" className="w-72 p-2">
        <div role="radiogroup" aria-label={t('icon.label')} className="grid grid-cols-6 gap-1">
          {WIKI_ICON_KEYS.map((key) => {
            const Icon = WIKI_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={node.icon === key}
                aria-label={t(`space.icons.${key}`)}
                onClick={() => onChange(key)}
                className={cn(
                  'flex size-10 items-center justify-center rounded-lg border transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                  node.icon === key
                    ? 'border-primary-border bg-primary-subtle text-primary-ink'
                    : 'border-transparent text-text-secondary hover:bg-surface-muted',
                )}
              >
                <Icon className="size-[18px] stroke-[1.6]" aria-hidden />
              </button>
            );
          })}
        </div>
        {node.icon && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="mt-2 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-sm text-text-secondary hover:bg-surface-muted focus-visible:shadow-focus focus-visible:outline-none"
          >
            <ImageOff className="size-4 stroke-[1.6]" aria-hidden />
            {t('icon.reset')}
          </button>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
