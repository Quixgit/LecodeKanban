import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Assignees, type Card, type TaskStatus } from '@/features/cards';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { isPast } from '@/shared/lib/dates';
import { formatDate } from '@/shared/lib/format';
import {
  Checkbox,
  PriorityPill,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type SortDirection,
} from '@/shared/ui';
import { RowActions } from './RowActions';

interface Props {
  status: TaskStatus;
  cards: Card[];
  loading: boolean;
  skeletonRows: number;
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  selection: RowSelectionState;
  onSelectionChange: (s: RowSelectionState) => void;
  canEdit: boolean;
  onEdit: (c: Card) => void;
  onOpen: (c: Card) => void;
  onMove: (c: Card, s: TaskStatus) => void;
  onDelete: (c: Card) => void;
  /** Virtualise rows (large "show all" lists). */
  virtual?: boolean;
}

const ROW_HEIGHT = 48;

/** Task table (TanStack Table): server-side sorting, row selection, optional virtualisation. */
export const TaskTable = memo(function TaskTable(props: Props) {
  const { t } = useTranslation(['tasks', 'common']);
  const { language } = useLanguage();
  const { cards, sorting, selection, canEdit } = props;

  const columns = useMemo<ColumnDef<Card>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        header: ({ table }) => (
          <Checkbox
            aria-label={t('select.all', { status: t(`common:status.${props.status}`) })}
            checked={
              table.getIsAllRowsSelected()
                ? true
                : table.getIsSomeRowsSelected()
                  ? 'indeterminate'
                  : false
            }
            onCheckedChange={(v) => table.toggleAllRowsSelected(v === true)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={t('select.row', { key: row.original.key })}
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
          />
        ),
      },
      {
        id: 'key',
        header: t('columns.key'),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.key}</span>,
      },
      {
        id: 'title',
        header: t('columns.title'),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => props.onOpen(row.original)}
            className="max-w-[320px] truncate text-left text-text hover:text-primary-ink"
          >
            {row.original.parent && (
              <span className="tabular mr-1.5 text-xs text-text-muted">
                {row.original.parent.key} ›
              </span>
            )}
            {row.original.title}
          </button>
        ),
      },
      {
        id: 'assignee',
        header: t('columns.assignee'),
        cell: ({ row }) => <Assignees people={row.original.assignees} />,
      },
      {
        id: 'project',
        header: t('columns.project'),
        cell: ({ row }) => <span className="truncate">{row.original.project.name}</span>,
      },
      {
        id: 'progress',
        header: t('columns.progress'),
        cell: ({ row }) => `${row.original.progress}%`,
      },
      {
        id: 'deadline',
        header: t('columns.deadline'),
        cell: ({ row }) => {
          const c = row.original;
          if (!c.dueDate) return <span className="text-text-faint">{t('noDue')}</span>;
          const late = c.status !== 'done' && isPast(c.dueDate);
          return (
            <span
              className={cn(
                'whitespace-nowrap',
                late ? 'font-medium text-danger-ink' : 'text-text',
              )}
            >
              {formatDate(c.dueDate, language)}
            </span>
          );
        },
      },
      {
        id: 'priority',
        header: t('columns.priority'),
        cell: ({ row }) => <PriorityPill priority={row.original.priority} size="sm" />,
      },
      {
        id: 'action',
        enableSorting: false,
        header: t('columns.action'),
        cell: ({ row }) => (
          <RowActions
            card={row.original}
            canEdit={canEdit}
            onEdit={props.onEdit}
            onMove={props.onMove}
            onDelete={props.onDelete}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language, canEdit, props.status],
  );

  const table = useReactTable({
    data: cards,
    columns,
    state: { sorting, rowSelection: selection },
    getRowId: (c) => c.id,
    enableRowSelection: canEdit,
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: (u) => props.onSortingChange(typeof u === 'function' ? u(sorting) : u),
    onRowSelectionChange: (u) =>
      props.onSelectionChange(typeof u === 'function' ? u(selection) : u),
    getCoreRowModel: getCoreRowModel(),
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    enabled: !!props.virtual,
  });
  const items = props.virtual ? virtualizer.getVirtualItems() : null;
  const padTop = items?.[0]?.start ?? 0;
  const padBottom =
    items && items.length ? virtualizer.getTotalSize() - items[items.length - 1]!.end : 0;
  const visible = items ? items.map((v) => rows[v.index]!) : rows;

  const sortDir = (id: string): SortDirection => {
    const s = sorting.find((x) => x.id === id);
    return s ? (s.desc ? 'desc' : 'asc') : false;
  };

  const body = (
    <Table>
      <THead className="sticky top-0 z-[1]">
        {table.getHeaderGroups().map((hg) => (
          <TR key={hg.id}>
            {hg.headers.map((h) => (
              <TH
                key={h.id}
                className={cn(
                  h.id === 'select' && 'w-12',
                  h.id === 'action' && 'w-20',
                  h.id === 'key' && 'w-28',
                  h.id === 'progress' && 'w-28',
                )}
                align={h.id === 'progress' ? 'right' : h.id === 'action' ? 'center' : 'left'}
                sortable={h.column.getCanSort()}
                sort={sortDir(h.id)}
                onSort={() => h.column.toggleSorting(undefined, false)}
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TH>
            ))}
          </TR>
        ))}
      </THead>
      <TBody>
        {props.loading
          ? Array.from({ length: props.skeletonRows }, (_, i) => (
              <TR key={i}>
                {columns.map((c) => (
                  <TD key={c.id}>
                    <Skeleton className="h-4" />
                  </TD>
                ))}
              </TR>
            ))
          : null}
        {!props.loading && padTop > 0 && (
          <tr aria-hidden>
            <td colSpan={columns.length} style={{ height: padTop }} />
          </tr>
        )}
        {!props.loading &&
          visible.map((row) => (
            <TR key={row.id} selected={row.getIsSelected()} className="h-row">
              {row.getVisibleCells().map((cell) => (
                <TD
                  key={cell.id}
                  align={
                    cell.column.id === 'progress'
                      ? 'right'
                      : cell.column.id === 'action'
                        ? 'center'
                        : undefined
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        {!props.loading && padBottom > 0 && (
          <tr aria-hidden>
            <td colSpan={columns.length} style={{ height: padBottom }} />
          </tr>
        )}
      </TBody>
    </Table>
  );

  return props.virtual ? (
    <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto">
      {body}
    </div>
  ) : (
    body
  );
});
