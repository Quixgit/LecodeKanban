import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLabelMutations, useLabels, type Label } from '@/features/cards';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FormAlert,
  IconButton,
  Input,
  Modal,
  Pill,
  Skeleton,
  toast,
  type Tone,
} from '@/shared/ui';
import { SectionHeader } from './SectionHeader';

const TONES: Tone[] = ['neutral', 'teal', 'amber', 'purple', 'red'];
const DOT: Record<Tone, string> = {
  neutral: 'bg-todo',
  teal: 'bg-done',
  amber: 'bg-progress',
  purple: 'bg-review',
  red: 'bg-danger',
};

/** Settings → Labels: the colours and names people tag tasks with. */
export function LabelsPage() {
  const { t } = useTranslation('settings');
  const { workspace } = useCurrentWorkspace();
  const labels = useLabels(workspace?.id);
  const [editing, setEditing] = useState<Label | 'new' | null>(null);
  const [removing, setRemoving] = useState<Label | null>(null);
  const reduce = useReducedMotion();
  if (!workspace) return <Skeleton className="h-48" />;
  const canEdit = workspace.role !== 'viewer';
  const list = labels.data ?? [];

  return (
    <div>
      <SectionHeader
        title={t('sections.labels.title')}
        description={t('sections.labels.description')}
        action={
          canEdit && (
            <Button onClick={() => setEditing('new')}>
              <Plus />
              {t('labels.new')}
            </Button>
          )
        }
      />
      {labels.isPending ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface">
          <EmptyState title={t('labels.empty')} description={t('labels.emptyHint')} />
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          <AnimatePresence initial={false}>
            {list.map((l) => (
              <motion.li
                key={l.id}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.18 }}
                className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3 shadow-xs"
              >
                <Pill tone={l.tone as Tone}>{l.name}</Pill>
                <span className="flex-1" />
                {canEdit && (
                  <>
                    <IconButton
                      label={t('labels.edit', { name: l.name })}
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(l)}
                    >
                      <Pencil />
                    </IconButton>
                    <IconButton
                      label={t('labels.remove', { name: l.name })}
                      size="sm"
                      variant="ghost"
                      onClick={() => setRemoving(l)}
                    >
                      <Trash2 />
                    </IconButton>
                  </>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {editing && (
        <LabelDialog
          key={editing === 'new' ? 'new' : editing.id}
          workspaceId={workspace.id}
          label={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <RemoveLabel workspaceId={workspace.id} label={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}

function LabelDialog({
  workspaceId,
  label,
  onClose,
}: {
  workspaceId: string;
  label?: Label;
  onClose: () => void;
}) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const m = useLabelMutations(workspaceId);
  const [name, setName] = useState(label?.name ?? '');
  const [tone, setTone] = useState<Tone>((label?.tone as Tone) ?? 'teal');
  const [error, setError] = useState<string | null>(null);
  const busy = m.create.isPending || m.update.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const done = { onSuccess: onClose, onError: (err: unknown) => setError(errorText(err)) };
    if (label) m.update.mutate({ id: label.id, patch: { name, tone } }, done);
    else m.create.mutate({ name, tone }, done);
  };

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={label ? t('labels.editTitle') : t('labels.newTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('labels.cancel')}
          </Button>
          <Button type="submit" form="label-form" loading={busy} disabled={!name.trim()}>
            {label ? t('labels.save') : t('labels.create')}
          </Button>
        </>
      }
    >
      <form id="label-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormAlert>{error}</FormAlert>}
        <Field label={t('labels.name')}>
          <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">{t('labels.colour')}</legend>
          <div className="flex gap-2" role="radiogroup" aria-label={t('labels.colour')}>
            {TONES.map((tn) => (
              <button
                key={tn}
                type="button"
                role="radio"
                aria-checked={tone === tn}
                aria-label={t(`labels.tones.${tn}`)}
                onClick={() => setTone(tn)}
                className={cn(
                  'grid size-9 place-items-center rounded-full border-2 outline-none transition-[border-color,transform] duration-micro focus-visible:shadow-focus',
                  tone === tn ? 'scale-110 border-text' : 'border-transparent hover:scale-105',
                )}
              >
                <span className={cn('size-6 rounded-full', DOT[tn])} />
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="mb-1 text-xs text-text-muted">{t('labels.preview')}</p>
          <Pill tone={tone}>{name.trim() || t('labels.previewName')}</Pill>
        </div>
      </form>
    </Modal>
  );
}

function RemoveLabel({
  workspaceId,
  label,
  onClose,
}: {
  workspaceId: string;
  label: Label | null;
  onClose: () => void;
}) {
  const { t } = useTranslation('settings');
  const errorText = useErrorText();
  const m = useLabelMutations(workspaceId);
  return (
    <ConfirmDialog
      open={!!label}
      onOpenChange={(o) => !o && onClose()}
      title={t('labels.removeTitle', { name: label?.name })}
      description={t('labels.removeBody')}
      confirmLabel={t('labels.removeConfirm')}
      loading={m.remove.isPending}
      onConfirm={() =>
        label &&
        m.remove.mutate(label.id, {
          onSuccess: () => {
            onClose();
            toast.success(t('labels.removed'));
          },
          onError: (e) => toast.error(errorText(e)),
        })
      }
    />
  );
}
