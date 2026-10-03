import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
  toneClasses,
} from '@/shared/ui';
import type { WikiSpace } from '../api/wikiApi';
import { useWikiMutations } from '../hooks/useWiki';
import { DEFAULT_SPACE_ICON, WIKI_ICONS, WIKI_ICON_KEYS, isIconKey } from '../model/icons';
import { SPACE_TONES, toneOf } from '../model/style';
import type { WikiVisibility } from '../model/tree';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Present when editing; absent when creating. */
  space?: WikiSpace;
  onSaved?: (space: WikiSpace) => void;
  onDeleted?: () => void;
}

const VISIBILITIES: WikiVisibility[] = ['private', 'shared', 'workspace'];

export function SpaceDialog(props: Props) {
  // Remount per opening so the form always starts from the space's current values.
  return props.open ? <SpaceForm {...props} /> : null;
}

function SpaceForm({ open, onOpenChange, workspaceId, space, onSaved, onDeleted }: Props) {
  const { t } = useTranslation('wiki');
  const errorText = useErrorText();
  const m = useWikiMutations(workspaceId);
  const [name, setName] = useState(space?.name ?? '');
  const [icon, setIcon] = useState<string>(
    isIconKey(space?.icon) ? space.icon : DEFAULT_SPACE_ICON,
  );
  const [color, setColor] = useState(toneOf(space?.color));
  const [description, setDescription] = useState(space?.description ?? '');
  const [visibility, setVisibility] = useState<WikiVisibility>(space?.visibility ?? 'private');
  const [maxDepth, setMaxDepth] = useState(String(space?.maxDepth ?? 12));
  const [error, setError] = useState<unknown>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameError = error && (error as { field?: (n: string) => unknown }).field?.('name');
  const pending = m.createSpace.isPending || m.updateSpace.isPending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const saved = space
        ? await m.updateSpace.mutateAsync({
            id: space.id,
            patch: { name, icon, color, description, maxDepth: Number(maxDepth) },
          })
        : await m.createSpace.mutateAsync({ name, icon, color, description, visibility });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      setError(err);
    }
  };

  const remove = async () => {
    if (!space) return;
    try {
      await m.deleteSpace.mutateAsync(space.id);
      setConfirmDelete(false);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={space ? t('space.editTitle') : t('space.createTitle')}
        description={space ? undefined : t('space.createDescription')}
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label={t('space.name')} error={nameError ? errorText(error) : undefined}>
            <Input
              value={name}
              maxLength={80}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              placeholder={t('space.namePlaceholder')}
            />
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-text">{t('space.icon')}</legend>
            <div role="radiogroup" aria-label={t('space.icon')} className="flex flex-wrap gap-1.5">
              {WIKI_ICON_KEYS.map((key) => {
                const Icon = WIKI_ICONS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={icon === key}
                    aria-label={t(`space.icons.${key}`)}
                    onClick={() => setIcon(key)}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg border transition-colors duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                      icon === key
                        ? 'border-primary-border bg-primary-subtle text-primary-ink'
                        : 'border-border bg-surface text-text-secondary hover:bg-surface-muted',
                    )}
                  >
                    <Icon className="size-[18px] stroke-[1.6]" aria-hidden />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-text">{t('space.color')}</legend>
            <div role="radiogroup" aria-label={t('space.color')} className="flex gap-2">
              {SPACE_TONES.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  role="radio"
                  aria-checked={color === tone}
                  aria-label={t(`space.tones.${tone}`)}
                  onClick={() => setColor(tone)}
                  className={cn(
                    'size-7 rounded-full border-2 transition-shadow duration-micro focus-visible:shadow-focus focus-visible:outline-none',
                    toneClasses[tone].fill,
                    color === tone ? 'border-text' : 'border-transparent',
                  )}
                />
              ))}
            </div>
          </fieldset>

          <Field label={t('space.description')}>
            <Textarea
              value={description}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-20"
            />
          </Field>

          {!space && (
            <Field label={t('space.visibility')}>
              <Select
                label={t('space.visibility')}
                value={visibility}
                onValueChange={(v) => setVisibility(v as WikiVisibility)}
                className="w-full justify-between"
                options={VISIBILITIES.map((v) => ({
                  value: v,
                  label: `${t(`visibility.${v}.name`)} — ${t(`visibility.${v}.description`)}`,
                }))}
              />
            </Field>
          )}

          {space && (
            <Field label={t('space.maxDepth')} hint={t('space.maxDepthHint')}>
              <Input
                type="number"
                min={2}
                max={32}
                value={maxDepth}
                onChange={(e) => setMaxDepth(e.target.value)}
                wrapperClassName="w-28"
              />
            </Field>
          )}

          {!!error && !nameError && (
            <p role="alert" className="text-sm text-danger-ink">
              {errorText(error)}
            </p>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-4">
            {space ? (
              <Button
                type="button"
                variant="ghost"
                className="text-danger-ink"
                onClick={() => setConfirmDelete(true)}
              >
                {t('space.delete')}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={pending} disabled={!name.trim()}>
                {space ? t('common.save') : t('space.create')}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
      {space && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('space.deleteTitle', { name: space.name })}
          description={t('space.deleteDescription')}
          confirmLabel={t('space.delete')}
          loading={m.deleteSpace.isPending}
          onConfirm={remove}
        />
      )}
    </>
  );
}
