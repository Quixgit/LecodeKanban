import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Button, Field, Input, Modal, Select, toast } from '@/shared/ui';
import { chatApi, type ChatStatus } from '../api/chatApi';
import { chatKeys } from '../hooks/useChat';
import {
  CLEAR_OPTIONS,
  KIND_ICONS,
  PRESETS,
  STATUS_ICONS,
  STATUS_ICON_KEYS,
  STATUS_KINDS,
  untilFor,
  type ClearAfter,
  type StatusIconKey,
  type StatusKind,
} from '../model/status';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  current?: ChatStatus;
}

/** Set a status: pick a ready-made one or write your own, choose availability and when it ends. */
export function StatusDialog(props: Props) {
  return props.open ? <Form {...props} /> : null;
}

function Form({ open, onOpenChange, workspaceId, current }: Props) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const qc = useQueryClient();
  const [kind, setKind] = useState<StatusKind>(current?.kind ?? 'available');
  const [icon, setIcon] = useState<StatusIconKey | null>(current?.icon ?? null);
  const [text, setText] = useState(current?.text ?? '');
  const [clear, setClear] = useState<ClearAfter>('never');
  const [busy, setBusy] = useState(false);

  const done = async () => {
    await qc.invalidateQueries({ queryKey: chatKeys.presence(workspaceId) });
    onOpenChange(false);
  };
  const save = async () => {
    setBusy(true);
    try {
      await chatApi.setStatus(workspaceId, {
        kind,
        icon,
        text: text.trim(),
        until: untilFor(clear) ?? null,
      });
      await done();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await chatApi.clearStatus(workspaceId);
      await done();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const pick = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!;
    setKind(p.kind);
    setIcon(p.icon);
    setText(t(`status.presets.${p.id}`));
    setClear(p.clear);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={t('status.title')}
      description={t('status.description')}
    >
      <div className="flex flex-col gap-5">
        <section aria-label={t('status.suggestions')}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('status.suggestions')}
          </h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {PRESETS.map((p) => {
              const Icon = STATUS_ICONS[p.icon];
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-base text-text outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Icon className="size-4 shrink-0 stroke-[1.7] text-text-muted" aria-hidden />
                    {t(`status.presets.${p.id}`)}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <Field label={t('status.text')}>
          <Input
            value={text}
            maxLength={100}
            placeholder={t('status.textPlaceholder')}
            leadingIcon={
              icon
                ? (() => {
                    const Icon = STATUS_ICONS[icon];
                    return <Icon />;
                  })()
                : undefined
            }
            onChange={(e) => setText(e.target.value)}
          />
        </Field>

        <div role="radiogroup" aria-label={t('status.icon')} className="flex flex-wrap gap-1">
          {STATUS_ICON_KEYS.map((k) => {
            const Icon = STATUS_ICONS[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={icon === k}
                aria-label={t(`status.icons.${k}`)}
                title={t(`status.icons.${k}`)}
                onClick={() => setIcon(icon === k ? null : k)}
                className={cn(
                  'grid size-9 place-items-center rounded-lg border outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                  icon === k
                    ? 'border-primary-border bg-primary-soft text-primary-ink'
                    : 'border-border text-text-secondary hover:bg-surface-muted',
                )}
              >
                <Icon className="size-4 stroke-[1.7]" aria-hidden />
              </button>
            );
          })}
        </div>

        <section aria-label={t('status.availability')}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t('status.availability')}
          </h3>
          <div
            role="radiogroup"
            aria-label={t('status.availability')}
            className="grid gap-1 sm:grid-cols-2"
          >
            {STATUS_KINDS.map((k) => {
              const Icon = KIND_ICONS[k];
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                    kind === k
                      ? 'border-primary-border bg-primary-subtle'
                      : 'border-border hover:bg-surface-muted',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 shrink-0 stroke-[1.7]',
                      k === 'available' ? 'text-available' : 'text-text-muted',
                    )}
                    aria-hidden
                  />
                  <span>
                    <span className="block text-sm font-medium text-text">
                      {t(`status.kinds.${k}`)}
                    </span>
                    <span className="block text-xs text-text-muted">
                      {t(`status.kindHints.${k}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Select
          label={t('status.clearAfter')}
          prefix={t('status.clearPrefix')}
          value={clear}
          onValueChange={(v) => setClear(v as ClearAfter)}
          options={CLEAR_OPTIONS.map((o) => ({ value: o, label: t(`status.clear.${o}`) }))}
        />

        <div className="flex items-center justify-between gap-2 border-t border-border-subtle pt-4">
          <Button variant="ghost" onClick={() => void remove()} disabled={busy || !current}>
            {t('status.remove')}
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void save()} loading={busy}>
              {t('status.save')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
