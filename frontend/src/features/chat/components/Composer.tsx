import {
  AtSign,
  Bold,
  Code,
  Italic,
  Loader2,
  Paperclip,
  SendHorizontal,
  TriangleAlert,
  Users,
  X,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { activeMention, mentionToken } from '@/shared/lib/mentions';
import { Avatar, IconButton, Kbd, Tooltip } from '@/shared/ui';
import { chatApi, type ChatFile } from '../api/chatApi';
import { useChatUiStore } from '../store/chatUiStore';
import { formatBytes, iconFor, isImage } from '../model/files';

const MAX_LEN = 8000;
const MAX_HEIGHT = 240;
const MAX_FILES = 10;
const TYPING_EVERY_MS = 3000;

interface Pending {
  key: string;
  name: string;
  size: number;
  status: 'uploading' | 'done' | 'error';
  file?: ChatFile;
  preview?: string;
}

type Special = { kind: 'special'; key: 'channel' | 'here' };
type Suggestion = Member | Special;
const isSpecial = (s: Suggestion): s is Special => 'kind' in s;

interface Props {
  /** Where the unsent text is kept: "c:<channel>" or "t:<thread>". */
  draftKey: string;
  placeholder: string;
  label: string;
  members: readonly Member[];
  /** Resolves when the message was sent; rejects to keep the text and files. */
  onSend: (body: string, fileIds: string[]) => Promise<unknown>;
  /** The channel files are uploaded to; omit to hide the attach button. */
  uploadTo?: string;
  /** Called (at most every few seconds) while the person is typing. */
  onTyping?: () => void;
  /** Offer @channel and @here in the mention list. */
  broadcast?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Focuses the field again when this changes (e.g. after opening a thread). */
  focusKey?: string;
  /** Shows the "Enter to send" reminder; hide it where the composer is narrow. */
  hint?: boolean;
}

/** Slack-style composer: Enter sends, Shift+Enter breaks the line, "@" mentions, files attach by button, drop or paste. */
export function Composer({
  draftKey,
  placeholder,
  label,
  members,
  onSend,
  uploadTo,
  onTyping,
  broadcast = true,
  autoFocus,
  disabled,
  focusKey,
  hint = true,
}: Props) {
  const { t } = useTranslation('chat');
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const draft = useChatUiStore((s) => s.drafts[draftKey] ?? '');
  const setDraft = useChatUiStore((s) => s.setDraft);
  const [text, setText] = useState(draft);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);

  // Switching channel swaps the draft; typing never writes to storage more than ~3 times a second.
  useEffect(() => {
    setText(useChatUiStore.getState().drafts[draftKey] ?? '');
    setPending([]);
  }, [draftKey]);
  useEffect(() => {
    const id = window.setTimeout(() => setDraft(draftKey, text), 300);
    return () => window.clearTimeout(id);
  }, [draftKey, text, setDraft]);
  useEffect(() => {
    if (autoFocus || focusKey) area.current?.focus();
  }, [autoFocus, focusKey, draftKey]);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, [text]);
  useEffect(
    () => () => pending.forEach((p) => p.preview && URL.revokeObjectURL(p.preview)),
    // Only on unmount: previews of removed items are revoked where they are removed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const mention = activeMention(text, caret);
  const matches = useMemo<Suggestion[]>(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    const specials: Special[] = broadcast
      ? (['channel', 'here'] as const)
          .filter((k) => k.startsWith(q))
          .map((key) => ({ kind: 'special', key }))
      : [];
    const people = members.filter((m) => m.user.name.toLowerCase().includes(q)).slice(0, 6);
    return [...specials, ...people];
  }, [mention, members, broadcast]);
  const open = matches.length > 0;
  const uploading = pending.some((p) => p.status === 'uploading');
  const ready = pending.filter((p) => p.status === 'done' && p.file);
  const body = text.trim();
  const canSend = (!!body || ready.length > 0) && !uploading && !sending && !disabled;

  const place = (next: string, pos: number) => {
    setText(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

  const pick = (s: Suggestion) => {
    if (!mention) return;
    const token = `${isSpecial(s) ? `@${s.key}` : mentionToken(s.user.name, s.user.id)} `;
    place(text.slice(0, mention.start) + token + text.slice(caret), mention.start + token.length);
  };

  const wrap = (before: string, after = before) => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    const next = text.slice(0, a) + before + text.slice(a, b) + after + text.slice(b);
    place(next, b + before.length + (a === b ? 0 : after.length));
  };

  const insertAt = () => {
    const el = area.current;
    const pos = el?.selectionStart ?? text.length;
    const needsSpace = pos > 0 && !/\s/.test(text[pos - 1]!);
    place(
      `${text.slice(0, pos)}${needsSpace ? ' ' : ''}@${text.slice(pos)}`,
      pos + (needsSpace ? 2 : 1),
    );
  };

  const addFiles = (list: FileList | File[]) => {
    if (!uploadTo) return;
    const files = [...list].slice(0, Math.max(0, MAX_FILES - pending.length));
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Math.random().toString(36).slice(2)}`;
      const preview = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      setPending((p) => [...p, { key, name: f.name, size: f.size, status: 'uploading', preview }]);
      chatApi
        .uploadFile(uploadTo, f)
        .then((file) =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'done', file } : x))),
        )
        .catch(() =>
          setPending((p) => p.map((x) => (x.key === key ? { ...x, status: 'error' } : x))),
        );
    }
  };

  const removePending = (key: string) =>
    setPending((p) => {
      const gone = p.find((x) => x.key === key);
      if (gone?.preview) URL.revokeObjectURL(gone.preview);
      return p.filter((x) => x.key !== key);
    });

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    const previous = text;
    const attached = pending;
    setText('');
    setDraft(draftKey, '');
    setPending([]);
    try {
      await onSend(
        body,
        ready.map((p) => p.file!.id),
      );
      attached.forEach((p) => p.preview && URL.revokeObjectURL(p.preview));
    } catch {
      setText(previous); // keep what was typed and attached; the caller shows the error
      setPending(attached);
    } finally {
      setSending(false);
      area.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setHighlight((h) => (h + d + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        pick(matches[Math.min(highlight, matches.length - 1)]!);
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setCaret(0);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrap('**');
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrap('_');
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const files = [...e.clipboardData.files];
    if (uploadTo && files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };
  const onDrop = (e: DragEvent) => {
    setDragging(false);
    if (!uploadTo || e.dataTransfer.files.length === 0) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="relative">
      <div
        onDragOver={(e) => {
          if (uploadTo && e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border bg-surface shadow-xs transition-[border-color,box-shadow] duration-micro',
          'focus-within:border-primary focus-within:shadow-focus',
          dragging ? 'border-primary bg-primary-subtle' : 'border-border',
          disabled && 'opacity-60',
        )}
      >
        {pending.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-3 pt-3" aria-label={t('composer.attachments')}>
            {pending.map((p) => (
              <li key={p.key}>
                <PendingChip pending={p} onRemove={() => removePending(p.key)} />
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={area}
          rows={1}
          value={text}
          maxLength={MAX_LEN}
          disabled={disabled}
          aria-label={label}
          placeholder={dragging ? t('composer.drop') : placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setHighlight(0);
            const now = Date.now();
            if (onTyping && e.target.value && now - lastTyping.current > TYPING_EVERY_MS) {
              lastTyping.current = now;
              onTyping();
            }
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="block max-h-60 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-base text-text placeholder:text-text-faint focus:outline-none"
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
          {uploadTo && (
            <>
              <input
                ref={picker}
                type="file"
                multiple
                hidden
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <Tooltip content={t('composer.attach')}>
                <IconButton
                  label={t('composer.attach')}
                  variant="ghost"
                  size="sm"
                  disabled={pending.length >= MAX_FILES}
                  onClick={() => picker.current?.click()}
                >
                  <Paperclip />
                </IconButton>
              </Tooltip>
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            </>
          )}
          <Tooltip content={t('composer.bold')}>
            <IconButton
              label={t('composer.bold')}
              variant="ghost"
              size="sm"
              onClick={() => wrap('**')}
            >
              <Bold />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('composer.italic')}>
            <IconButton
              label={t('composer.italic')}
              variant="ghost"
              size="sm"
              onClick={() => wrap('_')}
            >
              <Italic />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('composer.code')}>
            <IconButton
              label={t('composer.code')}
              variant="ghost"
              size="sm"
              onClick={() => wrap('`')}
            >
              <Code />
            </IconButton>
          </Tooltip>
          <Tooltip content={t('composer.mention')}>
            <IconButton label={t('composer.mention')} variant="ghost" size="sm" onClick={insertAt}>
              <AtSign />
            </IconButton>
          </Tooltip>
          {hint && (
            <span className="ml-auto hidden items-center gap-1 whitespace-nowrap pr-2 text-2xs text-text-muted sm:flex">
              <Kbd>Enter</Kbd> {t('composer.send')} <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd>{' '}
              {t('composer.newLine')}
            </span>
          )}
          <Tooltip content={t('composer.sendLabel')}>
            <IconButton
              label={t('composer.sendLabel')}
              size="sm"
              variant="ghost"
              disabled={!canSend}
              onClick={() => void send()}
              className={cn(
                hint ? 'ml-auto sm:ml-0' : 'ml-auto',
                canSend && '!bg-primary-solid !text-on-primary hover:!bg-primary-solid-hover',
              )}
            >
              <SendHorizontal />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      {open && (
        <ul
          role="listbox"
          aria-label={t('composer.mention')}
          className="absolute bottom-full left-2 z-20 mb-1 w-72 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {matches.map((m, i) => (
            <li
              key={isSpecial(m) ? m.key : m.user.id}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                i === highlight ? 'bg-primary-soft text-primary-ink' : 'text-text',
              )}
            >
              {isSpecial(m) ? (
                <>
                  <span className="grid size-6 place-items-center rounded-full bg-primary-soft text-primary-ink">
                    <Users className="size-3.5" aria-hidden />
                  </span>
                  <span className="font-medium">@{m.key}</span>
                  <span className="truncate text-xs text-text-muted">
                    {t(`composer.broadcast.${m.key}`)}
                  </span>
                </>
              ) : (
                <>
                  <Avatar size="xs" name={m.user.name} src={m.user.avatarUrl} />
                  {m.user.name}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PendingChip({ pending: p, onRemove }: { pending: Pending; onRemove: () => void }) {
  const { t } = useTranslation('chat');
  const Icon = iconFor({ name: p.name, contentType: p.file?.contentType ?? '' });
  const image = p.preview && (!p.file || isImage(p.file));
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-lg border bg-surface-muted py-1.5 pl-1.5 pr-2.5',
        p.status === 'error' ? 'border-danger' : 'border-border-subtle',
      )}
    >
      {image ? (
        <img src={p.preview} alt="" className="size-9 rounded-md object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-md bg-surface text-text-muted [&_svg]:size-4 [&_svg]:stroke-[1.6]">
          <Icon aria-hidden />
        </span>
      )}
      <span className="min-w-0 max-w-40">
        <span className="block truncate text-sm font-medium text-text">{p.name}</span>
        <span className="flex items-center gap-1 text-2xs text-text-muted">
          {p.status === 'uploading' && <Loader2 className="size-3 animate-spin" aria-hidden />}
          {p.status === 'error' && <TriangleAlert className="size-3 text-danger" aria-hidden />}
          {p.status === 'uploading'
            ? t('composer.uploading')
            : p.status === 'error'
              ? t('composer.uploadFailed')
              : formatBytes(p.size)}
        </span>
      </span>
      <IconButton
        label={t('composer.removeFile', { name: p.name })}
        variant="ghost"
        size="sm"
        onClick={onRemove}
        className="!size-6"
      >
        <X />
      </IconButton>
    </div>
  );
}
