import {
  ArrowLeft,
  ArrowRight,
  ChevronsLeftRight,
  ChevronsRightLeft,
  Gauge,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
  StatusTag,
} from '@/shared/ui';
import type { ColumnDef } from '../model/board';

export type ColumnAction = 'edit' | 'wip' | 'left' | 'right' | 'delete';

interface Props {
  column: ColumnDef;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Column management (project boards, editors only). */
  manage?: { first: boolean; last: boolean; onAction: (a: ColumnAction) => void };
}

export function ColumnHeader({ column, count, collapsed, onToggle, manage }: Props) {
  const { t } = useTranslation('kanban');
  const over = column.wipLimit !== null && count > column.wipLimit;
  const countLabel = column.wipLimit !== null ? `${count}/${column.wipLimit}` : String(count);
  const toggle = (
    <IconButton
      variant="ghost"
      size="sm"
      label={
        collapsed
          ? t('column.expand', { name: column.name })
          : t('column.collapse', { name: column.name })
      }
      aria-expanded={!collapsed}
      onClick={onToggle}
    >
      {collapsed ? <ChevronsLeftRight /> : <ChevronsRightLeft />}
    </IconButton>
  );

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-2 py-1">
        {toggle}
        <span
          className={cn(
            'tabular rounded-md px-1.5 text-xs font-medium',
            over ? 'bg-danger-soft text-danger-ink' : 'text-text-muted',
          )}
        >
          {countLabel}
        </span>
        <span className="text-sm font-medium text-text-secondary [writing-mode:vertical-rl]">
          {column.name}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <StatusTag status={column.status} label={column.name} className="h-8 min-w-0 text-base" />
      <span
        className={cn(
          'tabular flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm',
          over
            ? 'border-danger/40 bg-danger-soft font-medium text-danger-ink'
            : 'border-border text-text-secondary',
        )}
        title={
          column.wipLimit !== null ? t('column.wipHint', { limit: column.wipLimit }) : undefined
        }
      >
        {countLabel}
      </span>
      <div className="ml-auto flex items-center">
        {toggle}
        {manage && (
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton variant="ghost" size="sm" label={t('column.menu', { name: column.name })}>
                <MoreHorizontal />
              </IconButton>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownItem onSelect={() => manage.onAction('edit')}>
                <Pencil />
                {t('column.rename')}
              </DropdownItem>
              <DropdownItem onSelect={() => manage.onAction('wip')}>
                <Gauge />
                {t('column.wip')}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem disabled={manage.first} onSelect={() => manage.onAction('left')}>
                <ArrowLeft />
                {t('column.moveLeft')}
              </DropdownItem>
              <DropdownItem disabled={manage.last} onSelect={() => manage.onAction('right')}>
                <ArrowRight />
                {t('column.moveRight')}
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem className="text-danger-ink" onSelect={() => manage.onAction('delete')}>
                <Trash2 />
                {t('column.delete')}
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        )}
      </div>
    </div>
  );
}
