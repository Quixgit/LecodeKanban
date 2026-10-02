import { Plus, Tag } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabelMutations, useLabels, type Label } from '@/features/cards';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Dropdown,
  DropdownCheckboxItem,
  DropdownContent,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
  Pill,
  toast,
  toneClasses,
  type Tone,
} from '@/shared/ui';

const TONES: Tone[] = ['teal', 'amber', 'purple', 'red', 'neutral'];

/** Card labels: toggle workspace labels or create a new one inline. */
export function LabelPicker({
  workspaceId,
  value,
  editable,
  onChange,
}: {
  workspaceId: string;
  value: Label[];
  editable: boolean;
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation('card');
  const errorText = useErrorText();
  const labels = useLabels(workspaceId);
  const { create } = useLabelMutations(workspaceId);
  const [name, setName] = useState('');
  const [tone, setTone] = useState<Tone>('teal');
  const ids = value.map((l) => l.id);

  const pills = (
    <div className="flex flex-wrap gap-1.5">
      {value.length === 0 && (
        <span className="text-sm text-text-muted">{t('fields.noLabels')}</span>
      )}
      {value.map((l) => (
        <Pill key={l.id} tone={l.tone as Tone} size="sm">
          {l.name}
        </Pill>
      ))}
    </div>
  );
  if (!editable) return pills;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), tone },
      {
        onSuccess: (l) => {
          onChange([...ids, l.id]);
          setName('');
        },
        onError: (err) => toast.error(errorText(err)),
      },
    );
  };

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={t('fields.labels')}
          className="flex min-h-control w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-left hover:border-border data-[state=open]:border-primary"
        >
          <Tag className="size-4 shrink-0 text-text-muted" aria-hidden />
          {pills}
        </button>
      </DropdownTrigger>
      <DropdownContent align="start" className="w-64">
        <DropdownLabel>{t('fields.labels')}</DropdownLabel>
        {(labels.data ?? []).map((l) => (
          <DropdownCheckboxItem
            key={l.id}
            checked={ids.includes(l.id)}
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(on) => onChange(on ? [...ids, l.id] : ids.filter((x) => x !== l.id))}
          >
            <span
              className={cn('size-2.5 rounded-full', toneClasses[l.tone as Tone].fill)}
              aria-hidden
            />
            {l.name}
          </DropdownCheckboxItem>
        ))}
        <DropdownSeparator />
        <form
          onSubmit={submit}
          className="flex flex-col gap-2 p-2"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <input
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('labels.new')}
            aria-label={t('labels.new')}
            className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-text focus:border-primary focus:outline-none"
          />
          <div
            className="flex items-center gap-1.5"
            role="radiogroup"
            aria-label={t('labels.color')}
          >
            {TONES.map((tn) => (
              <button
                key={tn}
                type="button"
                role="radio"
                aria-checked={tone === tn}
                aria-label={t(`labels.tones.${tn}`)}
                onClick={() => setTone(tn)}
                className={cn(
                  'size-5 rounded-full ring-offset-2 ring-offset-surface',
                  toneClasses[tn].fill,
                  tone === tn && 'ring-2 ring-primary',
                )}
              />
            ))}
            <button
              type="submit"
              disabled={!name.trim() || create.isPending}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary-ink hover:bg-primary-soft disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              {t('labels.create')}
            </button>
          </div>
        </form>
      </DropdownContent>
    </Dropdown>
  );
}
