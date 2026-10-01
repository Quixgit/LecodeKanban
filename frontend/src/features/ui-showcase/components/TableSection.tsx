import { ArrowUpRight, ChevronUp, MoreHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { formatDate } from '@/shared/lib/format';
import {
  Avatar,
  Button,
  Checkbox,
  IconButton,
  Pagination,
  PriorityPill,
  StatusTag,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  type SortDirection,
} from '@/shared/ui';
import { demoTasks, type DemoTask } from '../model/demoData';
import { ShowcaseSection } from './ShowcaseSection';

type SortKey = 'id' | 'name' | 'assignee' | 'project' | 'progress' | 'deadline' | 'priority';
const priorityRank = { high: 0, medium: 1, low: 2 } as const;

function compare(a: DemoTask, b: DemoTask, key: SortKey): number {
  if (key === 'progress') return a.progress - b.progress;
  if (key === 'priority') return priorityRank[a.priority] - priorityRank[b.priority];
  return String(a[key]).localeCompare(String(b[key]));
}

export function TableSection() {
  const { t } = useTranslation('showcase');
  const { language } = useLanguage();
  const [sort, setSort] = useState<{ key: SortKey; dir: Exclude<SortDirection, false> } | null>(
    null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const list = demoTasks.filter((x) => x.status === 'todo' || x.status === 'in_progress');
    if (!sort) return list;
    return [...list].sort((a, b) => compare(a, b, sort.key) * (sort.dir === 'asc' ? 1 : -1));
  }, [sort]);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s?.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null,
    );
  const dirOf = (key: SortKey): SortDirection => (sort?.key === key ? sort.dir : false);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someChecked = rows.some((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  const toggleOne = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const columns: { key: SortKey; align?: 'right' }[] = [
    { key: 'id' },
    { key: 'name' },
    { key: 'assignee' },
    { key: 'project' },
    { key: 'progress', align: 'right' },
    { key: 'deadline' },
    { key: 'priority' },
  ];

  return (
    <ShowcaseSection id="table" title={t('table.title')} description={t('table.description')}>
      <div className="rounded-xl border border-border-subtle p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusTag status="todo" />
            <span className="tabular flex h-9 min-w-9 items-center justify-center rounded-lg border border-border px-2 text-md text-text-secondary">
              {rows.length}
            </span>
            <IconButton label={t('table.collapse')} variant="ghost" size="sm">
              <ChevronUp />
            </IconButton>
          </div>
          <Button variant="secondary" size="sm">
            {t('table.viewAll')}
            <ArrowUpRight />
          </Button>
        </div>
        <Table>
          <THead>
            <TR>
              <TH className="w-12">
                <Checkbox
                  aria-label={t('table.selectAll')}
                  checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                />
              </TH>
              {columns.map((c) => (
                <TH key={c.key} sortable sort={dirOf(c.key)} onSort={() => toggleSort(c.key)}>
                  {t(`table.columns.${c.key}`)}
                </TH>
              ))}
              <TH align="center">{t('table.columns.action')}</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TR key={r.id} selected={selected.has(r.id)}>
                <TD>
                  <Checkbox
                    aria-label={t('table.selectRow', { id: r.id })}
                    checked={selected.has(r.id)}
                    onCheckedChange={() => toggleOne(r.id)}
                  />
                </TD>
                <TD className="font-mono text-sm">{r.id}</TD>
                <TD className="max-w-[280px] truncate">{r.name}</TD>
                <TD>
                  <span className="flex items-center gap-2.5 font-medium text-text">
                    <Avatar name={r.assignee} size="sm" />
                    {r.assignee}
                  </span>
                </TD>
                <TD>{r.project}</TD>
                <TD align="right">{r.progress}%</TD>
                <TD className="whitespace-nowrap text-text">{formatDate(r.deadline, language)}</TD>
                <TD>
                  <PriorityPill priority={r.priority} />
                </TD>
                <TD align="center">
                  <IconButton label={t('table.rowActions')} size="sm">
                    <MoreHorizontal />
                  </IconButton>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
      <Pagination
        className="mt-5"
        page={page}
        pageSize={20}
        total={100}
        onPageChange={setPage}
        onShowAll={() => setPage(1)}
      />
    </ShowcaseSection>
  );
}
