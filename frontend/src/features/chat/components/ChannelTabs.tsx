import { MessageSquareText, Pin, Files } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { EmptyState, Skeleton } from '@/shared/ui';
import type { ChatChannel, ChatMessage } from '../api/chatApi';
import { useChannelFiles, usePins } from '../hooks/useChat';
import { isImage } from '../model/files';
import { Attachments, FileCard } from './Attachments';
import { MessageItem, type MessageActions } from './MessageItem';

export type ChannelTab = 'messages' | 'pins' | 'files';

/** Messages / Pins / Files, like the tab row under a Slack channel name. */
export function ChannelTabBar({
  value,
  onChange,
  pinCount,
}: {
  value: ChannelTab;
  onChange: (tab: ChannelTab) => void;
  pinCount?: number;
}) {
  const { t } = useTranslation('chat');
  const tabs: { key: ChannelTab; label: string; icon: typeof Pin }[] = [
    { key: 'messages', label: t('tabs.messages'), icon: MessageSquareText },
    {
      key: 'pins',
      label: pinCount ? t('tabs.pinsCount', { count: pinCount }) : t('tabs.pins'),
      icon: Pin,
    },
    { key: 'files', label: t('tabs.files'), icon: Files },
  ];
  return (
    <div
      role="tablist"
      aria-label={t('tabs.label')}
      className="flex gap-1 border-b border-border-subtle px-4"
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={cn(
              'relative flex h-10 items-center gap-1.5 px-3 text-sm font-medium outline-none transition-colors duration-micro focus-visible:shadow-focus',
              active ? 'text-primary-ink' : 'text-text-muted hover:text-text',
            )}
          >
            <Icon className="size-4 stroke-[1.7]" aria-hidden />
            {label}
            <span
              aria-hidden
              className={cn(
                'absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-primary transition-opacity duration-ui',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function PinsPanel({
  channel,
  me,
  canModerate,
  readOnly,
  actions,
}: {
  channel: ChatChannel;
  me: string;
  canModerate: boolean;
  readOnly: boolean;
  actions: MessageActions;
}) {
  const { t } = useTranslation('chat');
  const pins = usePins(channel.id);
  if (pins.isPending)
    return (
      <div className="space-y-3 p-5" aria-busy>
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  const list: ChatMessage[] = pins.data ?? [];
  if (list.length === 0)
    return (
      <EmptyState
        icon={<Pin />}
        title={t('pins.emptyTitle')}
        description={t('pins.emptyDescription')}
      />
    );
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto py-3" aria-label={t('tabs.pins')}>
      {list.map((m) => (
        <MessageItem
          key={m.id}
          message={m}
          compact={false}
          me={me}
          canModerate={canModerate}
          readOnly={readOnly}
          actions={actions}
        />
      ))}
    </ul>
  );
}

export function FilesPanel({ channel }: { channel: ChatChannel }) {
  const { t, i18n } = useTranslation('chat');
  const files = useChannelFiles(channel.id);
  if (files.isPending)
    return (
      <div className="grid gap-3 p-5 sm:grid-cols-3" aria-busy>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  const list = files.data ?? [];
  if (list.length === 0)
    return (
      <EmptyState
        icon={<Files />}
        title={t('files.emptyTitle')}
        description={t('files.emptyDescription')}
      />
    );
  const images = list.filter(isImage);
  const others = list.filter((f) => !isImage(f));
  const fmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });
  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
      {images.length > 0 && (
        <section aria-label={t('files.images')}>
          <h2 className="mb-2 text-sm font-semibold text-text">{t('files.images')}</h2>
          <Attachments files={images} />
        </section>
      )}
      {others.length > 0 && (
        <section aria-label={t('files.documents')}>
          <h2 className="mb-2 text-sm font-semibold text-text">{t('files.documents')}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {others.map((f) => (
              <li key={f.id}>
                <FileCard file={f} />
                <p className="mt-0.5 px-1 text-2xs text-text-muted">
                  {fmt.format(new Date(f.createdAt))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
