import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DateInput, IconButton, Input, Select, Switch } from '@/shared/ui';
import type { CustomField, FieldValue } from '../api/fieldsApi';

const NONE = '__none__';

interface Props {
  field: CustomField;
  value: unknown;
  disabled?: boolean;
  onCommit: (value: FieldValue) => void;
}

/** The right editor for a field's kind. Text-like inputs save when focus leaves; the rest at once. */
export function FieldValueInput({ field, value, disabled, onCommit }: Props) {
  const { t } = useTranslation('fields');
  const stored = value === null || value === undefined ? '' : String(value);
  const [draft, setDraft] = useState(stored);
  useEffect(() => setDraft(stored), [stored]);

  if (field.kind === 'checkbox') {
    return (
      <Switch
        checked={value === true}
        disabled={disabled}
        aria-label={field.name}
        onCheckedChange={(on) => onCommit(on)}
      />
    );
  }
  if (field.kind === 'select') {
    return (
      <div className="flex items-center gap-1.5">
        <Select
          className="min-w-0 flex-1 justify-between"
          label={field.name}
          disabled={disabled}
          value={typeof value === 'string' && value ? value : undefined}
          placeholder={t('card.empty')}
          onValueChange={(v) => onCommit(v === NONE ? null : v)}
          options={field.options.map((o) => ({ value: o.id, label: o.label }))}
        />
        {!disabled && typeof value === 'string' && value && (
          <IconButton
            label={t('card.clear')}
            size="sm"
            variant="ghost"
            onClick={() => onCommit(null)}
          >
            <X />
          </IconButton>
        )}
      </div>
    );
  }
  if (field.kind === 'date') {
    return (
      <DateInput
        aria-label={field.name}
        disabled={disabled}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          onCommit(e.target.value || null);
        }}
      />
    );
  }

  const commit = () => {
    if (draft === stored) return;
    if (field.kind === 'number') {
      const n = Number(draft);
      onCommit(draft.trim() === '' ? null : Number.isFinite(n) ? n : null);
    } else {
      onCommit(draft.trim() === '' ? null : draft.trim());
    }
  };
  return (
    <Input
      aria-label={field.name}
      disabled={disabled}
      type={field.kind === 'number' ? 'number' : field.kind === 'url' ? 'url' : 'text'}
      inputMode={field.kind === 'number' ? 'decimal' : undefined}
      placeholder={field.kind === 'url' ? 'https://' : t('card.empty')}
      maxLength={500}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
