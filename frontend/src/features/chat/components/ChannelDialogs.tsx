import { Check, Hash, Lock, Search, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { useErrorText } from '@/shared/hooks/useErrorText';
import { cn } from '@/shared/lib/cn';
import { Avatar, Button, Checkbox, Field, Input, Modal, Switch } from '@/shared/ui';
import type { ChatChannel } from '../api/chatApi';
import { useChatMutations } from '../hooks/useChat';
import { channelTitle, normalizeChannelName } from '../model/channels';

interface Common {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

interface CreateProps extends Common {
  members: readonly Member[];
  me: string;
  onCreated: (c: ChatChannel) => void;
}

export function CreateChannelDialog(props: CreateProps) {
  return props.open ? <CreateForm {...props} /> : null;
}

function CreateForm({ open, onOpenChange, workspaceId, members, me, onCreated }: CreateProps) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const m = useChatMutations(workspaceId);
  const [name, setName] = useState('');
  const [topic, setTopic] = useState('');
  const [isPrivate, setPrivate] = useState(false);
  const [invited, setInvited] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const normalized = normalizeChannelName(name);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!normalized) return;
    m.createChannel.mutate(
      { name: normalized, topic: topic.trim(), private: isPrivate, memberIds: invited },
      {
        onSuccess: (c) => {
          onOpenChange(false);
          onCreated(c);
        },
        onError: (err) => setError(errorText(err)),
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('create.title')}
      description={t('create.description')}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field
          label={t('create.name')}
          hint={
            normalized && normalized !== name.trim()
              ? t('create.willBe', { name: normalized })
              : t('create.nameHint')
          }
          error={error ?? undefined}
        >
          <Input
            autoFocus
            value={name}
            maxLength={60}
            leadingIcon={isPrivate ? <Lock /> : <Hash />}
            placeholder={t('create.namePlaceholder')}
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
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border-subtle p-3">
          <span>
            <span className="block text-sm font-medium text-text">{t('create.private')}</span>
            <span className="block text-xs text-text-muted">{t('create.privateHint')}</span>
          </span>
          <Switch
            checked={isPrivate}
            onCheckedChange={setPrivate}
            aria-label={t('create.private')}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-text">
            {t('create.invite')}{' '}
            <span className="font-normal text-text-muted">{t('create.optional')}</span>
          </legend>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leadingIcon={<Search />}
            placeholder={t('create.invitePlaceholder')}
            aria-label={t('create.invitePlaceholder')}
          />
          {invited.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={t('create.invited')}>
              {invited.map((id) => {
                const p = members.find((x) => x.user.id === id);
                return p ? (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setInvited((v) => v.filter((x) => x !== id))}
                      aria-label={t('create.uninvite', { name: p.user.name })}
                      className="inline-flex h-7 items-center gap-1.5 rounded-full bg-primary-soft py-0 pl-1 pr-2.5 text-sm font-medium text-primary-ink outline-none transition-colors duration-micro hover:bg-primary-soft/70 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Avatar
                        name={p.user.name}
                        src={p.user.avatarUrl}
                        size="xs"
                        className="!size-5"
                      />
                      {p.user.name}
                      <X className="size-3" aria-hidden />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
          <ul className="max-h-40 space-y-0.5 overflow-y-auto" aria-label={t('direct.people')}>
            {members
              .filter(
                (x) =>
                  x.user.id !== me &&
                  (!q.trim() || x.user.name.toLowerCase().includes(q.trim().toLowerCase())),
              )
              .map((x) => {
                const on = invited.includes(x.user.id);
                return (
                  <li key={x.user.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-micro hover:bg-surface-muted',
                        on && 'bg-primary-subtle',
                      )}
                    >
                      <Checkbox
                        checked={on}
                        onCheckedChange={(v) =>
                          setInvited((cur) =>
                            v === true ? [...cur, x.user.id] : cur.filter((id) => id !== x.user.id),
                          )
                        }
                        aria-label={x.user.name}
                      />
                      <Avatar name={x.user.name} src={x.user.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1 truncate text-base text-text">
                        {x.user.name}
                      </span>
                    </label>
                  </li>
                );
              })}
          </ul>
        </fieldset>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={m.createChannel.isPending} disabled={!normalized}>
            {t('create.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Pick one or more teammates; opens (or creates) the conversation with them. */
export function NewMessageDialog({
  open,
  onOpenChange,
  workspaceId,
  members,
  me,
  onOpened,
}: Common & { members: readonly Member[]; me: string; onOpened: (c: ChatChannel) => void }) {
  return open ? (
    <NewMessageForm
      open={open}
      onOpenChange={onOpenChange}
      workspaceId={workspaceId}
      members={members}
      me={me}
      onOpened={onOpened}
    />
  ) : null;
}

const MAX_OTHERS = 7;

function NewMessageForm({
  open,
  onOpenChange,
  workspaceId,
  members,
  me,
  onOpened,
}: Common & { members: readonly Member[]; me: string; onOpened: (c: ChatChannel) => void }) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const m = useChatMutations(workspaceId);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return members.filter(
      (x) => x.user.id !== me && (!needle || x.user.name.toLowerCase().includes(needle)),
    );
  }, [members, me, q]);

  const toggle = (id: string, on: boolean) =>
    setPicked((p) => (on ? (p.length < MAX_OTHERS ? [...p, id] : p) : p.filter((x) => x !== id)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.openDirect.mutate(picked, {
      onSuccess: (c) => {
        onOpenChange(false);
        onOpened(c);
      },
      onError: (err) => setError(errorText(err)),
    });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={t('direct.title')}
      description={t('direct.description', { max: MAX_OTHERS })}
    >
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          leadingIcon={<Search />}
          placeholder={t('direct.search')}
          aria-label={t('direct.search')}
        />
        <ul className="max-h-64 space-y-0.5 overflow-y-auto" aria-label={t('direct.people')}>
          {list.map((x) => {
            const on = picked.includes(x.user.id);
            return (
              <li key={x.user.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-micro hover:bg-surface-muted',
                    on && 'bg-primary-subtle',
                  )}
                >
                  <Checkbox
                    checked={on}
                    onCheckedChange={(v) => toggle(x.user.id, v === true)}
                    aria-label={x.user.name}
                  />
                  <Avatar name={x.user.name} src={x.user.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-base text-text">{x.user.name}</span>
                </label>
              </li>
            );
          })}
          {list.length === 0 && (
            <li className="px-2 py-3 text-sm text-text-muted">{t('direct.none')}</li>
          )}
        </ul>
        {error && (
          <p role="alert" className="text-xs text-danger-ink">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs text-text-muted">
            {t('direct.selected', { count: picked.length })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={m.openDirect.isPending}>
              {picked.length === 0 ? t('direct.notes') : t('direct.open')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

/** Every public channel in the workspace, joined or not. */
export function BrowseChannelsDialog({
  open,
  onOpenChange,
  workspaceId,
  channels,
  me,
  onOpen,
}: Common & { channels: readonly ChatChannel[]; me: string; onOpen: (c: ChatChannel) => void }) {
  const { t } = useTranslation('chat');
  const errorText = useErrorText();
  const m = useChatMutations(workspaceId);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = channels.filter(
    (c) => c.kind === 'public' && (!q.trim() || (c.name ?? '').includes(q.trim().toLowerCase())),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('browse.title')}
      description={t('browse.description')}
    >
      <div className="flex flex-col gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          leadingIcon={<Search />}
          placeholder={t('browse.search')}
          aria-label={t('browse.search')}
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {list.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-lg border border-border-subtle px-3 py-2"
            >
              <Hash className="size-4 shrink-0 text-text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-text">
                  {channelTitle(c, me, '')}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {t('browse.members', { count: c.memberCount })}
                  {c.topic ? ` · ${c.topic}` : ''}
                </p>
              </div>
              {c.joined ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onOpenChange(false);
                    onOpen(c);
                  }}
                >
                  <Check />
                  {t('browse.open')}
                </Button>
              ) : (
                <Button
                  size="sm"
                  loading={m.join.isPending && m.join.variables === c.id}
                  onClick={() =>
                    m.join.mutate(c.id, {
                      onSuccess: (joined) => {
                        onOpenChange(false);
                        onOpen(joined);
                      },
                      onError: (err) => setError(errorText(err)),
                    })
                  }
                >
                  {t('browse.join')}
                </Button>
              )}
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-text-muted">{t('browse.none')}</li>
          )}
        </ul>
        {error && (
          <p role="alert" className="text-xs text-danger-ink">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
