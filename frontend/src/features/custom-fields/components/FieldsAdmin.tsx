import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, LayoutPanelTop, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Pill,
  Skeleton,
  Switch,
  Tooltip,
  toast,
  type Tone,
} from '@/shared/ui';
import type { CustomField } from '../api/fieldsApi';
import { useCustomFields, useFieldMutations } from '../hooks/useFields';
import { KIND_ICONS } from '../model/kinds';
import { FieldEditor, type FieldDraft } from './FieldEditor';

/** Ready-made starting points, shown while there are no fields. */
const SUGGESTIONS: { key: string; draft: FieldDraft }[] = [
  { key: 'budget', draft: { kind: 'number', showOnCard: true } },
  { key: 'points', draft: { kind: 'number', showOnCard: true } },
  { key: 'risk', draft: { kind: 'select', showOnCard: true, options: ['Low', 'Medium', 'High'] } },
  { key: 'customer', draft: { kind: 'text' } },
  { key: 'link', draft: { kind: 'url' } },
];

/** Settings → Custom fields: define the extra fields every card of the workspace can hold. */
export function FieldsAdmin({ workspaceId, canEdit }: { workspaceId: string; canEdit: boolean }) {
  const { t } = useTranslation('fields');
  const errorText = useErrorText();
  const reduce = useReducedMotion();
  const fields = useCustomFields(workspaceId);
  const m = useFieldMutations(workspaceId);
  const [editing, setEditing] = useState<{ field?: CustomField; draft?: FieldDraft } | null>(null);
  const [removing, setRemoving] = useState<CustomField | null>(null);
  const list = fields.data ?? [];

  const move = (i: number, by: -1 | 1) => {
    const ids = list.map((f) => f.id);
    const [id] = ids.splice(i, 1);
    ids.splice(i + by, 0, id!);
    m.reorder.mutate(ids, { onError: (e) => toast.error(errorText(e)) });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-text-muted">{t('intro')}</p>
        {canEdit && (
          <Button onClick={() => setEditing({})}>
            <Plus />
            {t('new')}
          </Button>
        )}
      </div>

      {fields.isPending ? (
        <div className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6">
          <EmptyState
            title={t('empty.title')}
            description={canEdit ? t('empty.hint') : t('empty.readOnly')}
          />
          {canEdit && (
            <ul
              className="mt-2 flex flex-wrap justify-center gap-2"
              aria-label={t('empty.suggestions')}
            >
              {SUGGESTIONS.map(({ key, draft }) => (
                <li key={key}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setEditing({ draft: { ...draft, name: t(`suggest.${key}`) } })}
                  >
                    <Plus />
                    {t(`suggest.${key}`)}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {list.map((f, i) => {
              const Icon = KIND_ICONS[f.kind];
              return (
                <motion.li
                  key={f.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-3 shadow-xs"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary-ink">
                    <Icon className="size-5 stroke-[1.7]" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      <span className="truncate">{f.name}</span>
                      <Pill size="sm" tone="neutral">
                        {t(`kinds.${f.kind}`)}
                      </Pill>
                    </p>
                    {f.kind === 'select' ? (
                      <ul className="mt-1 flex flex-wrap gap-1">
                        {f.options.map((o) => (
                          <li key={o.id}>
                            <Pill size="sm" tone={o.tone as Tone} className="h-5 px-2 text-2xs">
                              {o.label}
                            </Pill>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      f.description && (
                        <p className="truncate text-xs text-text-muted">{f.description}</p>
                      )
                    )}
                  </div>
                  <Tooltip content={t('onCardTip')}>
                    <label className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
                      <LayoutPanelTop className="size-4 text-text-muted" aria-hidden />
                      <span className="hidden sm:inline">{t('onCard')}</span>
                      <Switch
                        checked={f.showOnCard}
                        disabled={!canEdit}
                        aria-label={t('onCardFor', { name: f.name })}
                        onCheckedChange={(showOnCard) =>
                          m.update.mutate(
                            { id: f.id, patch: { showOnCard } },
                            { onError: (e) => toast.error(errorText(e)) },
                          )
                        }
                      />
                    </label>
                  </Tooltip>
                  {canEdit && (
                    <div className={cn('flex shrink-0 items-center')}>
                      <IconButton
                        label={t('moveUp', { name: f.name })}
                        size="sm"
                        variant="ghost"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp />
                      </IconButton>
                      <IconButton
                        label={t('moveDown', { name: f.name })}
                        size="sm"
                        variant="ghost"
                        disabled={i === list.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </IconButton>
                      <IconButton
                        label={t('edit', { name: f.name })}
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing({ field: f })}
                      >
                        <Pencil />
                      </IconButton>
                      <IconButton
                        label={t('remove', { name: f.name })}
                        size="sm"
                        variant="ghost"
                        onClick={() => setRemoving(f)}
                      >
                        <Trash2 />
                      </IconButton>
                    </div>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}

      {editing && (
        <FieldEditor
          key={editing.field?.id ?? editing.draft?.name ?? 'new'}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          workspaceId={workspaceId}
          field={editing.field}
          draft={editing.draft}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={t('removeTitle', { name: removing?.name })}
        description={t('removeBody')}
        confirmLabel={t('removeConfirm')}
        loading={m.remove.isPending}
        onConfirm={() =>
          removing &&
          m.remove.mutate(removing.id, {
            onSuccess: () => {
              setRemoving(null);
              toast.success(t('removed'));
            },
            onError: (e) => toast.error(errorText(e)),
          })
        }
      />
    </div>
  );
}
