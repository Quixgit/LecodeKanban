import { Bell, Check, Hash, Lock, RefreshCw, Unplug } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannels } from '@/features/chat';
import { useCurrentWorkspace } from '@/features/workspaces';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { Button, Select, Switch, toast } from '@/shared/ui';
import type { IntegrationEntry } from '../api/integrationsApi';
import { useIntegrationMutations } from '../hooks/useIntegrations';
import { MeetingList } from './MeetingList';

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3.5">
      <div className="min-w-0 max-w-xs">
        <p className="text-sm font-medium text-text">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The body of Google Calendar's settings panel: connect, or (connected) sync, reminders and what is coming. */
export function GoogleCalendarSettings({
  entry,
  leadChoices,
}: {
  entry: IntegrationEntry;
  leadChoices: number[];
}) {
  const { t } = useTranslation('integrations');
  const { language } = useLanguage();
  const errorText = useErrorText();
  const { workspace } = useCurrentWorkspace();
  const channels = useChannels(workspace?.id).data ?? [];
  const m = useIntegrationMutations();
  const [confirm, setConfirm] = useState(false);
  const fail = (e: unknown) => toast.error(errorText(e));
  const patch = (p: Parameters<typeof m.update.mutate>[0]['patch']) =>
    m.update.mutate({ provider: entry.provider, patch: p }, { onError: fail });
  const reconnect = entry.connected && entry.status === 'error';
  const writable = channels.filter(
    (c) => (c.kind === 'public' || c.kind === 'private') && c.joined && !c.feed,
  );

  const connect = () =>
    m.connect.mutate(entry.provider, {
      onSuccess: (r) => window.location.assign(r.url),
      onError: fail,
    });

  if (!entry.connected || reconnect) {
    return (
      <div className="flex flex-col gap-5">
        {reconnect ? (
          <p role="alert" className="text-sm text-danger-ink">
            {t('reconnectHint')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5 text-sm text-text-secondary">
            {(['sidebar', 'reminder', 'channel'] as const).map((k) => (
              <li key={k} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-primary-ink" aria-hidden />
                {t(`benefits.${k}`)}
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2.5">
          <Button onClick={connect} loading={m.connect.isPending}>
            {reconnect ? t('reconnect') : t('connect')}
          </Button>
          {reconnect && (
            <Button
              variant="ghost"
              loading={m.disconnect.isPending}
              onClick={() => m.disconnect.mutate(entry.provider, { onError: fail })}
            >
              {t('disconnect')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface-muted px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-text">
            {t('account', { email: entry.accountEmail })}
          </p>
          <p className="text-xs text-text-muted">
            {entry.lastSyncAt
              ? t('synced', { when: formatRelative(entry.lastSyncAt, language) })
              : t('neverSynced')}
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          loading={m.sync.isPending}
          onClick={() => m.sync.mutate(entry.provider, { onError: fail })}
        >
          <RefreshCw />
          {t('syncNow')}
        </Button>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-border-subtle px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-text">{t('active.label')}</span>
          <span className="block text-xs text-text-muted">{t('active.hint')}</span>
        </span>
        <Switch
          checked={entry.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
          aria-label={t('active.label')}
        />
      </label>

      <section aria-label={t('reminder.title')} className="divide-y divide-border-subtle">
        <h3 className="pb-2 text-sm font-semibold text-text">{t('reminder.title')}</h3>
        <Row title={t('reminder.lead')} hint={t('reminder.leadHint')}>
          <Select
            label={t('reminder.lead')}
            value={String(entry.leadMinutes)}
            disabled={!entry.enabled}
            onValueChange={(v) => patch({ leadMinutes: Number(v) })}
            options={leadChoices.map((n) => ({
              value: String(n),
              label: t('reminder.minutesBefore', { count: n }),
            }))}
          />
        </Row>
        <Row title={t('reminder.bell')} hint={t('reminder.bellHint')}>
          <Switch
            checked={entry.notifyBell}
            disabled={!entry.enabled}
            onCheckedChange={(notifyBell) => patch({ notifyBell })}
            aria-label={t('reminder.bell')}
          />
        </Row>
        <Row title={t('reminder.channel')} hint={t('reminder.channelHint')}>
          <Select
            label={t('reminder.channel')}
            value={entry.channelId ?? 'none'}
            disabled={!entry.enabled}
            onValueChange={(v) =>
              v === 'none' ? patch({ clearChannel: true }) : patch({ channelId: v })
            }
            options={[
              { value: 'none', label: t('reminder.noChannel') },
              ...writable.map((c) => ({
                value: c.id,
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    {c.kind === 'private' ? (
                      <Lock className="size-3.5" aria-hidden />
                    ) : (
                      <Hash className="size-3.5" aria-hidden />
                    )}
                    {c.name}
                  </span>
                ),
              })),
            ]}
          />
        </Row>
      </section>

      <section aria-label={t('meetings.title')} className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Bell className="size-4 text-text-muted" aria-hidden />
          {t('meetings.title')}
        </h3>
        <MeetingList />
      </section>

      <div className="border-t border-border-subtle pt-4">
        <DisconnectBar
          confirming={confirm}
          loading={m.disconnect.isPending}
          onAsk={() => setConfirm(true)}
          onCancel={() => setConfirm(false)}
          onConfirm={() =>
            m.disconnect.mutate(entry.provider, {
              onSuccess: () => setConfirm(false),
              onError: fail,
            })
          }
        />
      </div>
    </div>
  );
}

/** Disconnecting asks inside the panel (a second dialog on top of a side panel is awkward to use). */
function DisconnectBar({
  confirming,
  loading,
  onAsk,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  loading: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation('integrations');
  if (!confirming) {
    return (
      <div className="flex justify-end">
        <Button variant="ghost" onClick={onAsk}>
          <Unplug />
          {t('disconnect')}
        </Button>
      </div>
    );
  }
  return (
    <div
      role="group"
      aria-label={t('disconnectTitle')}
      className="rounded-lg border border-danger/30 bg-danger-soft p-4"
    >
      <p className="text-sm font-medium text-danger-ink">{t('disconnectTitle')}</p>
      <p className="mt-1 text-xs text-danger-ink">{t('disconnectBody')}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button size="sm" variant="danger" loading={loading} onClick={onConfirm}>
          {t('disconnectConfirm')}
        </Button>
      </div>
    </div>
  );
}
