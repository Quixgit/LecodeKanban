import { motion } from 'framer-motion';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Copy,
  Ellipsis,
  MessageSquareText,
  Pencil,
  Pin,
  PinOff,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { memo, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import {
  Avatar,
  AvatarGroup,
  Button,
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
  IconButton,
  Markdown,
  Tooltip,
} from '@/shared/ui';
import type { ChatMessage } from '../api/chatApi';
import type { ReactionKey } from '../model/reactions';
import { Attachments } from './Attachments';
import { ReactionBar, ReactionPicker } from './ReactionBar';

export interface MessageActions {
  react: (message: ChatMessage, key: ReactionKey, on: boolean) => void;
  edit: (message: ChatMessage, body: string) => Promise<unknown>;
  remove: (message: ChatMessage) => void;
  save?: (message: ChatMessage, on: boolean) => void;
  pin?: (message: ChatMessage, on: boolean) => void;
  /** Absent inside a thread, where replies cannot nest. */
  openThread?: (message: ChatMessage) => void;
  copyLink?: (message: ChatMessage) => void;
}

interface Props {
  message: ChatMessage;
  compact: boolean;
  me: string;
  canModerate: boolean;
  readOnly?: boolean;
  highlighted?: boolean;
  actions: MessageActions;
}

function useTimeFormat() {
  const { i18n } = useTranslation('chat');
  return {
    short: (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { hour: 'numeric', minute: '2-digit' }).format(
        new Date(iso),
      ),
    full: (iso: string) =>
      new Intl.DateTimeFormat(i18n.language, { dateStyle: 'full', timeStyle: 'short' }).format(
        new Date(iso),
      ),
  };
}

/** One message: avatar, author, time, Markdown body, reactions, thread summary, hover actions. */
export const MessageItem = memo(function MessageItem({
  message: m,
  compact,
  me,
  canModerate,
  readOnly,
  highlighted,
  actions,
}: Props) {
  const { t } = useTranslation('chat');
  const time = useTimeFormat();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.body);
  const [saving, setSaving] = useState(false);
  const mine = m.author?.id === me;
  const mentionsMe = m.mentions.some((p) => p.id === me);
  const author = m.author?.name ?? t('message.unknownAuthor');

  const save = async () => {
    const body = draft.trim();
    if (!body || body === m.body) return setEditing(false);
    setSaving(true);
    try {
      await actions.edit(m, body);
      setEditing(false);
    } catch {
      // The caller already surfaced the error; stay in edit mode so nothing is lost.
    } finally {
      setSaving(false);
    }
  };
  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(false);
    }
  };

  const toolbar = !readOnly && !m.deleted && !editing && (
    <div
      className={cn(
        'absolute -top-4 right-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5 shadow-md',
        'pointer-events-none opacity-0 transition-opacity duration-micro',
        'focus-within:pointer-events-auto focus-within:opacity-100 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100',
      )}
    >
      <Tooltip content={t('reactions.names.thumbs-up')}>
        <IconButton
          label={t('reactions.names.thumbs-up')}
          variant="ghost"
          size="sm"
          onClick={() => actions.react(m, '👍', !m.reactions.find((r) => r.key === '👍')?.mine)}
        >
          <ThumbsUp />
        </IconButton>
      </Tooltip>
      <ReactionPicker
        onPick={(key) => actions.react(m, key, !m.reactions.find((r) => r.key === key)?.mine)}
      />
      {actions.save && (
        <Tooltip content={m.saved ? t('message.unsave') : t('message.save_later')}>
          <IconButton
            label={m.saved ? t('message.unsave') : t('message.save_later')}
            variant="ghost"
            size="sm"
            aria-pressed={m.saved}
            onClick={() => actions.save?.(m, !m.saved)}
          >
            {m.saved ? <BookmarkCheck className="text-primary-ink" /> : <Bookmark />}
          </IconButton>
        </Tooltip>
      )}
      {actions.openThread && (
        <Tooltip content={t('message.reply')}>
          <IconButton
            label={t('message.reply')}
            variant="ghost"
            size="sm"
            onClick={() => actions.openThread?.(m)}
          >
            <MessageSquareText />
          </IconButton>
        </Tooltip>
      )}
      <Dropdown>
        <Tooltip content={t('message.more')}>
          <DropdownTrigger asChild>
            <IconButton label={t('message.more')} variant="ghost" size="sm">
              <Ellipsis />
            </IconButton>
          </DropdownTrigger>
        </Tooltip>
        <DropdownContent className="min-w-44">
          {actions.copyLink && (
            <DropdownItem onSelect={() => actions.copyLink?.(m)}>
              <Copy />
              {t('message.copyLink')}
            </DropdownItem>
          )}
          {actions.pin && !m.parentId && (
            <DropdownItem onSelect={() => actions.pin?.(m, !m.pinned)}>
              {m.pinned ? <PinOff /> : <Pin />}
              {m.pinned ? t('message.unpin') : t('message.pin')}
            </DropdownItem>
          )}
          {mine && (
            <DropdownItem
              onSelect={() => {
                setDraft(m.body);
                setEditing(true);
              }}
            >
              <Pencil />
              {t('message.edit')}
            </DropdownItem>
          )}
          {(mine || canModerate) && (
            <DropdownItem danger onSelect={() => actions.remove(m)}>
              <Trash2 />
              {t('message.delete')}
            </DropdownItem>
          )}
        </DropdownContent>
      </Dropdown>
    </div>
  );

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.ui}
      data-message-id={m.id}
      aria-label={t('message.aria', { author, time: time.full(m.createdAt) })}
      className={cn(
        'group/msg relative flex gap-3 border-l-4 border-transparent py-1 pl-4 pr-5 focus-within:bg-surface-muted/70 hover:bg-surface-muted/70',
        !compact && 'mt-2 pt-1.5',
        mentionsMe && 'border-warning bg-warning/10 hover:bg-warning/15',
        highlighted && 'bg-primary-soft/60',
      )}
    >
      {toolbar}
      <div className="w-9 shrink-0 pt-0.5">
        {compact ? (
          <span
            className="hidden select-none whitespace-nowrap pt-1 text-center text-2xs text-text-muted group-hover/msg:block"
            title={time.full(m.createdAt)}
          >
            {time.short(m.createdAt)}
          </span>
        ) : (
          <Avatar name={author} src={m.author?.avatarUrl} size="md" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-text">{author}</span>
            <time
              dateTime={m.createdAt}
              title={time.full(m.createdAt)}
              className="text-xs text-text-muted"
            >
              {time.short(m.createdAt)}
            </time>
            {m.pinned && (
              <span className="inline-flex items-center gap-1 text-2xs font-medium text-primary-ink">
                <Pin className="size-3" aria-hidden />
                {t('message.pinned')}
              </span>
            )}
            {m.saved && (
              <BookmarkCheck
                className="size-3.5 text-primary-ink"
                aria-label={t('message.savedBadge')}
              />
            )}
          </div>
        )}
        {m.deleted ? (
          <p className="py-0.5 text-base italic text-text-muted">{t('message.deleted')}</p>
        ) : editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              rows={2}
              value={draft}
              maxLength={8000}
              disabled={saving}
              aria-label={t('message.editLabel')}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onEditKey}
              className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base text-text focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/10 focus-visible:shadow-none"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" onClick={() => void save()} disabled={saving || !draft.trim()}>
                <Check />
                {t('message.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                {t('message.cancel')}
              </Button>
              <span className="text-2xs text-text-muted">{t('message.editHint')}</span>
            </div>
          </div>
        ) : (
          <div className="[&>div>p:first-child]:mt-0 [&>div>p:last-child]:mb-0">
            {m.body && <Markdown source={m.body} />}
            {m.editedAt && (
              <span className="text-2xs text-text-muted" title={time.full(m.editedAt)}>
                {t('message.edited')}
              </span>
            )}
          </div>
        )}
        {!m.deleted && <Attachments files={m.files} />}
        {!m.deleted && (
          <ReactionBar
            reactions={m.reactions}
            readOnly={readOnly}
            onToggle={(key, on) => actions.react(m, key, on)}
          />
        )}
        {actions.openThread && m.replyCount > 0 && (
          <button
            type="button"
            onClick={() => actions.openThread?.(m)}
            className="mt-1.5 inline-flex items-center gap-2 rounded-md px-1.5 py-1 text-xs font-medium text-primary-ink outline-none transition-colors duration-micro hover:bg-primary-soft focus-visible:shadow-focus"
          >
            {m.replyPeople.length > 0 ? (
              <AvatarGroup
                size="xs"
                max={3}
                people={m.replyPeople.map((p) => ({ name: p.name, src: p.avatarUrl }))}
              />
            ) : (
              <MessageSquareText className="size-3.5" aria-hidden />
            )}
            {t('message.replies', { count: m.replyCount })}
            {m.lastReplyAt && (
              <span className="font-normal text-text-muted">
                {t('message.lastReply', { time: time.short(m.lastReplyAt) })}
              </span>
            )}
          </button>
        )}
      </div>
    </motion.li>
  );
});
