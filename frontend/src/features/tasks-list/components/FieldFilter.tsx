import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCustomFields, type CustomField } from '@/features/custom-fields';
import { useCurrentWorkspace } from '@/features/workspaces';
import { Button, FilterSelect, Input } from '@/shared/ui';
import type { TaskFilters } from '../model/filters';

type Update = (p: Record<string, string | undefined>) => void;

/** The value control of a field filter, by the kind of the field. */
function ValueControl({
  field,
  filters,
  update,
}: {
  field: CustomField;
  filters: TaskFilters;
  update: Update;
}) {
  const { t } = useTranslation('tasks');
  const typed = field.kind === 'text' || field.kind === 'url';
  const [text, setText] = useState(filters.fieldValue ?? '');
  useEffect(() => setText(filters.fieldValue ?? ''), [filters.fieldValue]);
  // Typing is debounced into the address, like the search box.
  useEffect(() => {
    if (!(typed || field.kind === 'number' || field.kind === 'date')) return;
    if (text === (filters.fieldValue ?? '')) return;
    const id = window.setTimeout(() => update({ fieldValue: text || undefined }), 300);
    return () => window.clearTimeout(id);
  }, [text, typed, field.kind, filters.fieldValue, update]);

  if (field.kind === 'select') {
    return (
      <FilterSelect
        className="w-full justify-between"
        label={t('filters.fieldValue')}
        placeholder={t('filters.fieldValue')}
        anyLabel={t('filters.any')}
        value={filters.fieldValue}
        onChange={(v) => update({ fieldValue: v })}
        options={field.options.map((o) => ({ value: o.id, label: o.label }))}
      />
    );
  }
  if (field.kind === 'checkbox') {
    return (
      <FilterSelect
        className="w-full justify-between"
        label={t('filters.fieldValue')}
        placeholder={t('filters.fieldValue')}
        anyLabel={t('filters.any')}
        value={filters.fieldValue}
        onChange={(v) => update({ fieldValue: v })}
        options={[
          { value: 'true', label: t('filters.yes') },
          { value: 'false', label: t('filters.no') },
        ]}
      />
    );
  }
  return (
    <Input
      aria-label={t('filters.fieldValue')}
      placeholder={t('filters.fieldValue')}
      type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  );
}

/** Filter and sort by one of the workspace's custom fields. */
export function FieldFilter({ filters, update }: { filters: TaskFilters; update: Update }) {
  const { t } = useTranslation('tasks');
  const { workspace } = useCurrentWorkspace();
  const fields = useCustomFields(workspace?.id).data ?? [];
  if (fields.length === 0) return null;
  const chosen = fields.find((f) => f.id === filters.fieldId);
  const sortedBy = fields.find((f) => f.id === filters.sortField);
  const pick = (id: string | undefined) => {
    const f = fields.find((x) => x.id === id);
    update({
      fieldId: id,
      fieldValue: undefined,
      fieldMatch: f && (f.kind === 'text' || f.kind === 'url') ? 'contains' : undefined,
    });
  };
  return (
    <>
      <FilterSelect
        className="w-full justify-between"
        label={t('filters.field')}
        placeholder={t('filters.field')}
        anyLabel={t('filters.any')}
        value={filters.fieldId}
        onChange={pick}
        options={fields.map((f) => ({ value: f.id, label: f.name }))}
      />
      {chosen && <ValueControl key={chosen.id} field={chosen} filters={filters} update={update} />}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterSelect
            className="w-full justify-between"
            label={t('filters.sortField')}
            placeholder={t('filters.sortField')}
            anyLabel={t('filters.noSort')}
            value={filters.sortField}
            onChange={(v) =>
              update({ sortField: v, sortOrder: v ? (filters.sortOrder ?? 'asc') : undefined })
            }
            options={fields.map((f) => ({ value: f.id, label: f.name }))}
          />
        </div>
        {sortedBy && (
          <Button
            variant="secondary"
            size="sm"
            aria-label={t(filters.sortOrder === 'desc' ? 'filters.sortDesc' : 'filters.sortAsc')}
            onClick={() => update({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })}
          >
            {filters.sortOrder === 'desc' ? <ArrowDownAZ /> : <ArrowUpAZ />}
          </Button>
        )}
      </div>
    </>
  );
}
