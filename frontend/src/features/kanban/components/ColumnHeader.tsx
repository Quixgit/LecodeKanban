import {
  ArrowLeft,
  ArrowRight,
  Gauge,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { columnLabel } from '@/shared/lib/columnName';
import { cn } from '@/shared/lib/cn';
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  DropdownTrigger,
  IconButton,
  StatusTag,
  Tooltip,
} from '@/shared/ui';
import type { ColumnDef } from '../model/board';

export type ColumnAction = 'edit' | 'wip' | 'left' | 'right' | 'delete';

interface Props {
  column: ColumnDef;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  /** Persistent "+": opens quick-add in this column. Absent for viewers. */
  onAdd?: () => void;
  /** Column management (project boards, editors only). */
  manage?: { first: boolean; last: boolean; onAction: (a: ColumnAction) => void };
}

export function ColumnHeader({ column, count, collapsed, onToggle, onAdd, manage }: Props) {
  const { t, i18n } = useTranslation('kanban');
  const name = columnLabel(column.name, column.status, i18n.t(`common:status.${column.status}`));
  const over = column.wipLimit !== null && count > column.wipLimit;
  const countLabel = column.wipLimit !== null ? `${count} / ${column.wipLimit}` : String(count);
  const toggleLabel = collapsed ? t('column.expand', { name }) : t('column.collapse', { name });
  const toggle = (
    <Tooltip content={toggleLabel}>
      <IconButton
        variant="ghost"
        size="sm"
        label={toggleLabel}
        aria-expanded={!collapsed}
        onClick={onToggle}
        className={cn(
          !collapsed &&
            'opacity-0 transition-opacity duration-micro focus-visible:opacity-100 group-focus-within/head:opacity-100 group-hover/head:opacity-100 [@media(hover:none)]:opacity-100',
        )}
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </IconButton>
    </Tooltip>
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
          {name}
        </span>
      </div>
    );
  }

  return (
    <div className="group/head flex items-center gap-2 px-2">
      <StatusTag status={column.status} label={name} className="h-8 min-w-0 text-base" />
      <span
        className={cn(
          'tabular flex h-8 min-w-8 items-center justify-center rounded-full border px-2.5 text-sm',
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
      {over && <span className="sr-only">{t('column.wipExceeded')}</span>}
      <div className="ml-auto flex items-center">
        {toggle}
        {onAdd && (
          <Tooltip content={t('quickAdd.button')}>
            <IconButton variant="ghost" size="sm" label={t('quickAdd.button')} onClick={onAdd}>
              <Plus />
            </IconButton>
          </Tooltip>
        )}
        {manage && (
          <Dropdown>
            <DropdownTrigger asChild>
              <IconButton variant="ghost" size="sm" label={t('column.menu', { name })}>
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
