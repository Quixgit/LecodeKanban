import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Button, Field, FormAlert, IconButton, Input, Modal, Select, Switch } from '@/shared/ui';
import type { CustomField, CustomFieldKind, FieldOption } from '../api/fieldsApi';
import { useFieldMutations } from '../hooks/useFields';
import { KIND_ICONS, KINDS, TONES } from '../model/kinds';

const DOT: Record<string, string> = {
  neutral: 'bg-todo',
  teal: 'bg-done',
  amber: 'bg-progress',
  purple: 'bg-review',
  red: 'bg-danger',
};

export interface FieldDraft {
  name?: string;
  kind?: CustomFieldKind;
  options?: string[];
  showOnCard?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** The field being edited, or undefined to create one (optionally from a suggestion). */
  field?: CustomField;
  draft?: FieldDraft;
}

/** Create or edit a custom field. The kind is fixed once the field exists. */
export function FieldEditor({ open, onOpenChange, workspaceId, field, draft }: Props) {
  const { t } = useTranslation('fields');
  const errorText = useErrorText();
  const m = useFieldMutations(workspaceId);
  const [name, setName] = useState(field?.name ?? draft?.name ?? '');
  const [description, setDescription] = useState(field?.description ?? '');
  const [kind, setKind] = useState<CustomFieldKind>(field?.kind ?? draft?.kind ?? 'text');
  const [options, setOptions] = useState<FieldOption[]>(
    field?.options ??
      (draft?.options ?? []).map((label, i) => ({ id: '', label, tone: TONES[i % TONES.length]! })),
  );
  const [showOnCard, setShowOnCard] = useState(field?.showOnCard ?? draft?.showOnCard ?? false);
  const [error, setError] = useState<string | null>(null);
  const busy = m.create.isPending || m.update.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = options.filter((o) => o.label.trim());
    const done = {
      onSuccess: () => onOpenChange(false),
      onError: (err: unknown) => setError(errorText(err)),
    };
    if (field) {
      m.update.mutate(
        {
          id: field.id,
          patch: {
            name,
            description,
            showOnCard,
            ...(kind === 'select' ? { options: clean } : {}),
          },
        },
        done,
      );
    } else {
      m.create.mutate(
        { name, description, kind, showOnCard, ...(kind === 'select' ? { options: clean } : {}) },
        done,
      );
    }
  };
  const setOption = (i: number, patch: Partial<FieldOption>) =>
    setOptions((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={field ? t('editor.editTitle') : t('editor.newTitle')}
      description={t('editor.description')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('editor.cancel')}
          </Button>
          <Button type="submit" form="field-editor" loading={busy} disabled={!name.trim()}>
            {field ? t('editor.save') : t('editor.create')}
          </Button>
        </>
      }
    >
      <form id="field-editor" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={t('editor.name')}>
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label={t('editor.kind')} hint={field ? t('editor.kindLocked') : undefined}>
          <Select
            className="w-full justify-between"
            label={t('editor.kind')}
            value={kind}
            disabled={!!field}
            onValueChange={(k) => setKind(k as CustomFieldKind)}
            options={KINDS.map((k) => {
              const Icon = KIND_ICONS[k];
              return {
                value: k,
                label: (
                  <span className="flex items-center gap-2">
                    <Icon className="size-4 text-text-muted" aria-hidden />
                    {t(`kinds.${k}`)}
                  </span>
                ),
              };
            })}
          />
        </Field>
        {kind === 'select' && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-text">{t('editor.options')}</legend>
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select
                  label={t('editor.tone')}
                  value={o.tone}
                  onValueChange={(tone) => setOption(i, { tone: tone as FieldOption['tone'] })}
                  options={TONES.map((tone) => ({
                    value: tone,
                    label: <span className={cn('block size-3 rounded-full', DOT[tone])} />,
                  }))}
                />
                <Input
                  wrapperClassName="flex-1"
                  aria-label={t('editor.optionLabel', { n: i + 1 })}
                  value={o.label}
                  maxLength={40}
                  onChange={(e) => setOption(i, { label: e.target.value })}
                />
                <IconButton
                  label={t('editor.removeOption')}
                  size="sm"
                  variant="ghost"
                  onClick={() => setOptions((x) => x.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() =>
                setOptions((x) => [
                  ...x,
                  { id: '', label: '', tone: TONES[x.length % TONES.length]! },
                ])
              }
            >
              <Plus />
              {t('editor.addOption')}
            </Button>
          </fieldset>
        )}
        <Field label={t('editor.help')} hint={t('editor.helpHint')}>
          <Input
            value={description}
            maxLength={200}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border-subtle p-3">
          <span>
            <span className="block text-sm font-medium text-text">{t('editor.onCard')}</span>
            <span className="block text-xs text-text-muted">{t('editor.onCardHint')}</span>
          </span>
          <Switch
            checked={showOnCard}
            onCheckedChange={setShowOnCard}
            aria-label={t('editor.onCard')}
          />
        </label>
      </form>
    </Modal>
  );
}
