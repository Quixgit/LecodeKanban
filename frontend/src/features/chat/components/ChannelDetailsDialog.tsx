import { BellOff, ClipboardList, LogOut, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { Button, ConfirmDialog, Field, Input, Modal, Select, Switch, toast } from '@/shared/ui';
import type { ChatChannel, ChatNotifyLevel } from '../api/chatApi';
import { useChannelMembers, useChatMutations } from '../hooks/useChat';
import { channelTitle } from '../model/channels';
import { FeedProjectSelect, type FeedProject } from './ChannelDialogs';
import { FeedEventsPicker } from './FeedEventsPicker';
import { useStatuses } from '../hooks/usePresence';
import { PersonAvatar, StatusBadge } from './PresenceDot';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  channel: ChatChannel;
  me: string;
  members: readonly Member[];
  isAdmin: boolean;
  canWrite: boolean;
  online: ReadonlySet<string>;
  projects: readonly FeedProject[];
  /** Called after the user leaves or the channel is archived. */
  onGone: () => void;
}

/** Topic, members, notifications and leaving, in one place (Slack's channel details). */
export function ChannelDetailsDialog(props: Props) {
  return props.open ? <Details {...props} /> : null;
}

function Details({
  open,
  onOpenChange,
  workspaceId,
  channel,
  me,
  members,
  isAdmin,
  canWrite,
  online,
  projects,
  onGone,
}: Props) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const m = useChatMutations(workspaceId);
  const people = useChannelMembers(channel.id);
  const statuses = useStatuses(workspaceId);
  const direct = channel.kind === 'dm';
  const [name, setName] = useState(channel.name ?? '');
  const [topic, setTopic] = useState(channel.topic);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'leave' | 'archive' | null>(null);
  const [adding, setAdding] = useState('');

  const inChannel = new Set((people.data ?? []).map((p) => p.id));
  const candidates = members.filter((x) => !inChannel.has(x.user.id));
  const changed = name !== (channel.name ?? '') || topic !== channel.topic;

  const save = (e: FormEvent) => {
    e.preventDefault();
    m.updateChannel.mutate(
      { id: channel.id, patch: { name: name || undefined, topic } },
      {
        onSuccess: () => toast.success(t('details.saved')),
        onError: (err) => setError(errorText(err)),
      },
    );
  };
  const run = (kind: 'leave' | 'archive') => {
    const done = () => {
      setConfirm(null);
      onOpenChange(false);
      onGone();
    };
    if (kind === 'leave')
      m.leave.mutate(channel.id, { onSuccess: done, onError: (e) => toast.error(errorText(e)) });
    else
      m.archive.mutate(channel.id, { onSuccess: done, onError: (e) => toast.error(errorText(e)) });
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={channelTitle(channel, me, t('list.you'))}
        description={direct ? t('details.directDescription') : t(`details.kind.${channel.kind}`)}
      >
        <div className="flex flex-col gap-5">
          {!direct && canWrite && (
            <form onSubmit={save} className="flex flex-col gap-3">
              <Field label={t('create.name')} error={error ?? undefined}>
                <Input
                  value={name}
                  maxLength={60}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError(null);
                  }}
                />
              </Field>
              <Field label={t('create.topic')}>
                <Input
                  value={topic}
                  maxLength={250}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t('create.topicPlaceholder')}
                />
              </Field>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={!changed}
                  loading={m.updateChannel.isPending}
                >
                  {t('details.save')}
                </Button>
              </div>
            </form>
          )}

          {!direct && canWrite && (
            <section
              className="rounded-lg border border-border-subtle p-3"
              aria-label={t('feed.toggle')}
            >
              <label className="flex cursor-pointer items-start justify-between gap-4">
                <span>
                  <span className="flex items-center gap-2 text-sm font-medium text-text">
                    <ClipboardList className="size-4 text-primary-ink" aria-hidden />
                    {t('feed.detailsToggle')}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {t('feed.toggleHint')}
                  </span>
                </span>
                <Switch
                  checked={channel.feed}
                  onCheckedChange={(on) =>
                    m.updateChannel.mutate(
                      {
                        id: channel.id,
                        patch: {
                          feed: on,
                          feedProjectId: channel.feedProjectId,
                          feedEvents: channel.feedEvents,
                        },
                      },
                      { onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                  aria-label={t('feed.detailsToggle')}
                />
              </label>
              {channel.feed && (
                <FeedProjectSelect
                  value={channel.feedProjectId ?? 'all'}
                  projects={projects}
                  onChange={(v) =>
                    m.updateChannel.mutate(
                      {
                        id: channel.id,
                        patch: {
                          feed: true,
                          feedProjectId: v === 'all' ? null : v,
                          feedEvents: channel.feedEvents,
                        },
                      },
                      { onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                />
              )}
              {channel.feed && (
                <FeedEventsPicker
                  value={channel.feedEvents}
                  onChange={(events) =>
                    m.updateChannel.mutate(
                      {
                        id: channel.id,
                        patch: {
                          feed: true,
                          feedProjectId: channel.feedProjectId,
                          feedEvents: events,
                        },
                      },
                      { onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                />
              )}
            </section>
          )}

          {channel.joined && (
            <section className="rounded-lg border border-border-subtle p-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-text">
                <BellOff className="size-4 text-text-muted" aria-hidden />
                {t('details.notify')}
              </h3>
              <p className="mb-2 mt-0.5 text-xs text-text-muted">{t('details.notifyHint')}</p>
              <Select
                label={t('details.notify')}
                value={channel.notify}
                onValueChange={(level) =>
                  m.setNotify.mutate(
                    { id: channel.id, level: level as ChatNotifyLevel },
                    { onError: (e) => toast.error(errorText(e)) },
                  )
                }
                options={(['all', 'mentions', 'muted'] as const).map((value) => ({
                  value,
                  label: t(`menu.${value}`),
                }))}
              />
            </section>
          )}

          <section aria-label={t('details.members')}>
            <h3 className="mb-2 text-sm font-semibold text-text">
              {t('details.members')}{' '}
              <span className="font-normal text-text-muted">
                {people.data?.length ?? channel.memberCount}
              </span>
            </h3>
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {(people.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-1 py-1">
                  <PersonAvatar
                    name={p.name}
                    src={p.avatarUrl}
                    online={online.has(p.id)}
                    status={statuses.get(p.id)}
                    size="sm"
                  />
                  <span className="truncate text-base text-text">
                    {p.name}
                    {p.id === me && <span className="text-text-muted"> ({t('list.you')})</span>}
                    <StatusBadge
                      status={statuses.get(p.id)}
                      className="ml-1.5 inline-flex align-middle"
                    />
                  </span>
                </li>
              ))}
            </ul>
            {!direct && canWrite && channel.joined && candidates.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    label={t('details.addPeople')}
                    value={adding}
                    onValueChange={setAdding}
                    placeholder={t('details.addPeople')}
                    options={candidates.map((x) => ({ value: x.user.id, label: x.user.name }))}
                  />
                </div>
                <Button
                  variant="secondary"
                  disabled={!adding}
                  loading={m.addMembers.isPending}
                  onClick={() =>
                    m.addMembers.mutate(
                      { id: channel.id, userIds: [adding] },
                      { onSuccess: () => setAdding(''), onError: (e) => toast.error(errorText(e)) },
                    )
                  }
                >
                  <Plus />
                  {t('details.add')}
                </Button>
              </div>
            )}
          </section>

          {!direct && (
            <div className="flex flex-wrap justify-between gap-2 border-t border-border-subtle pt-4">
              {channel.joined ? (
                <Button variant="secondary" onClick={() => setConfirm('leave')}>
                  <LogOut />
                  {t('details.leave')}
                </Button>
              ) : (
                <span />
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  className="text-danger-ink"
                  onClick={() => setConfirm('archive')}
                >
                  <Trash2 />
                  {t('details.archive')}
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'archive' ? t('details.archiveTitle') : t('details.leaveTitle')}
        description={confirm === 'archive' ? t('details.archiveBody') : t('details.leaveBody')}
        confirmLabel={confirm === 'archive' ? t('details.archive') : t('details.leave')}
        loading={m.leave.isPending || m.archive.isPending}
        onConfirm={() => confirm && run(confirm)}
      />
    </>
  );
}
