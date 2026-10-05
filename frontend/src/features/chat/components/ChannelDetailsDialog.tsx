import { copyText } from '@/shared/lib/clipboard';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  ClipboardList,
  Link2,
  LogOut,
  Paperclip,
  Pin,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { OpenMemberCard } from '@/features/member-card';
import type { Member } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import {
  Button,
  ConfirmDialog,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Switch,
  toast,
} from '@/shared/ui';
import type { ChatChannel } from '../api/chatApi';
import { useChannelMembers, useChatMutations } from '../hooks/useChat';
import { channelTitle } from '../model/channels';
import { MUTE_PRESETS, muteUntil } from '../model/mute';
import { FeedProjectSelect, type FeedProject } from './ChannelDialogs';
import { FeedEventsPicker } from './FeedEventsPicker';
import { useStatuses } from '../hooks/usePresence';
import { PersonAvatar, StatusBadge } from './PresenceDot';

export type DetailsTab = 'about' | 'members' | 'notifications';

interface Props {
  open: boolean;
  /** The tab to start on. */
  initialTab?: DetailsTab;
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
  initialTab = 'about',
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
  const [tab, setTab] = useState<DetailsTab>(initialTab);
  const [query, setQuery] = useState('');
  const { language } = useLanguage();
  const navigate = useNavigate();
  const copyLink = async () => {
    try {
      if (!(await copyText(`${window.location.origin}/chat/${channel.id}`)))
        throw new Error('copy failed');
      toast.success(t('menu.copied'));
    } catch {
      toast.error(t('menu.copyFailed'));
    }
  };
  const openTab = (name: 'pins' | 'files') => {
    onOpenChange(false);
    navigate(`/chat/${channel.id}?tab=${name}`);
  };

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
        size="lg"
        title={channelTitle(channel, me, t('list.you'))}
        description={direct ? t('details.directDescription') : t(`details.kind.${channel.kind}`)}
      >
        <div className="flex flex-col gap-5">
          <SegmentedControl
            label={t('details.tabs')}
            value={tab}
            onChange={setTab}
            options={[
              { value: 'about', label: t('details.tab.about') },
              {
                value: 'members',
                label: `${t('details.tab.members')} ${people.data?.length ?? channel.memberCount}`,
              },
              { value: 'notifications', label: t('details.tab.notifications') },
            ]}
          />
          {tab === 'about' && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void copyLink()}>
                  <Link2 />
                  {t('menu.copyLink')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openTab('pins')}>
                  <Pin />
                  {t('details.pinned')}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => openTab('files')}>
                  <Paperclip />
                  {t('details.files')}
                </Button>
              </div>
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
            </>
          )}
          {tab === 'members' && (
            <>
              <section aria-label={t('details.members')}>
                <h3 className="mb-2 text-sm font-semibold text-text">
                  {t('details.members')}{' '}
                  <span className="font-normal text-text-muted">
                    {people.data?.length ?? channel.memberCount}
                  </span>
                </h3>
                {(people.data?.length ?? 0) > 6 && (
                  <Input
                    aria-label={t('details.findMember')}
                    placeholder={t('details.findMember')}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    wrapperClassName="mb-2"
                  />
                )}
                <ul className="max-h-72 space-y-1 overflow-y-auto">
                  {(people.data ?? [])
                    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
                    .map((p) => (
                      <li key={p.id} className="flex items-center gap-3 px-1 py-1">
                        <PersonAvatar
                          name={p.name}
                          src={p.avatarUrl}
                          online={online.has(p.id)}
                          status={statuses.get(p.id)}
                          size="sm"
                        />
                        <span className="truncate text-base text-text">
                          <OpenMemberCard
                            userId={p.id}
                            label={t('message.openProfile', { name: p.name })}
                            className="font-medium"
                          >
                            {p.name}
                          </OpenMemberCard>
                          {p.id === me && (
                            <span className="text-text-muted"> ({t('list.you')})</span>
                          )}
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
                          {
                            onSuccess: () => setAdding(''),
                            onError: (e) => toast.error(errorText(e)),
                          },
                        )
                      }
                    >
                      <Plus />
                      {t('details.add')}
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}
          {tab === 'notifications' && (
            <>
              {channel.joined ? (
                <section aria-label={t('details.notify')} className="flex flex-col gap-4">
                  <p className="text-sm text-text-muted">{t('details.notifyHint')}</p>
                  <div
                    role="radiogroup"
                    aria-label={t('details.notify')}
                    className="flex flex-col gap-2"
                  >
                    {(['all', 'mentions', 'muted'] as const).map((level) => {
                      const Icon =
                        level === 'muted' ? BellOff : level === 'mentions' ? Bell : BellRing;
                      const on = channel.notify === level;
                      return (
                        <button
                          key={level}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() =>
                            m.setNotify.mutate(
                              { id: channel.id, level },
                              { onError: (e) => toast.error(errorText(e)) },
                            )
                          }
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-3 text-left outline-none transition-colors duration-micro focus-visible:shadow-focus',
                            on
                              ? 'border-primary-border bg-primary-subtle'
                              : 'border-border-subtle hover:border-border hover:bg-surface-muted',
                          )}
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-primary-ink">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-text">
                              {t(`menu.${level}`)}
                            </span>
                            <span className="block text-xs text-text-muted">
                              {t(`menu.${level}Hint`)}
                            </span>
                          </span>
                          {on && <Check className="size-4 text-primary" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-medium text-text">{t('menu.tempMute')}</h3>
                    <div className="flex flex-wrap gap-2">
                      {MUTE_PRESETS.map((preset) => (
                        <Button
                          key={preset}
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            m.setNotify.mutate(
                              { id: channel.id, level: 'muted', until: muteUntil(preset) },
                              { onError: (e) => toast.error(errorText(e)) },
                            )
                          }
                        >
                          {t(`menu.mute.${preset}`)}
                        </Button>
                      ))}
                    </div>
                    {channel.mutedUntil && (
                      <p className="mt-2 text-xs text-text-muted">
                        {t('menu.mutedUntil', { when: formatDate(channel.mutedUntil, language) })}
                      </p>
                    )}
                  </div>
                </section>
              ) : (
                <p className="text-sm text-text-muted">{t('details.joinFirst')}</p>
              )}
            </>
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
