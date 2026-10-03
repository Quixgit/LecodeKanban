import { AtSign, Bold, Code, Italic, SendHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Member } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { activeMention, mentionToken } from '@/shared/lib/mentions';
import { Avatar, IconButton, Kbd, Tooltip } from '@/shared/ui';
import { useChatUiStore } from '../store/chatUiStore';

const MAX_LEN = 8000;
const MAX_HEIGHT = 240;

interface Props {
  /** Where the unsent text is kept: "c:<channel>" or "t:<thread>". */
  draftKey: string;
  placeholder: string;
  label: string;
  members: readonly Member[];
  /** Resolves when the message was sent; rejects to keep the text. */
  onSend: (body: string) => Promise<unknown>;
  autoFocus?: boolean;
  disabled?: boolean;
  /** Focuses the field again when this changes (e.g. after opening a thread). */
  focusKey?: string;
  /** Shows the "Enter to send" reminder; hide it where the composer is narrow. */
  hint?: boolean;
}

/** Slack-style composer: Enter sends, Shift+Enter breaks the line, "@" picks a teammate. */
export function Composer({
  draftKey,
  placeholder,
  label,
  members,
  onSend,
  autoFocus,
  disabled,
  focusKey,
  hint = true,
}: Props) {
  const { t } = useTranslation('chat');
  const area = useRef<HTMLTextAreaElement>(null);
  const draft = useChatUiStore((s) => s.drafts[draftKey] ?? '');
  const setDraft = useChatUiStore((s) => s.setDraft);
  const [text, setText] = useState(draft);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const [sending, setSending] = useState(false);

  // Switching channel swaps the draft; typing never writes to storage more than ~3 times a second.
  useEffect(() => setText(useChatUiStore.getState().drafts[draftKey] ?? ''), [draftKey]);
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

  const mention = activeMention(text, caret);
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.user.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, members]);
  const open = matches.length > 0;
  const body = text.trim();

  const place = (next: string, pos: number) => {
    setText(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  };

  const pick = (m: Member) => {
    if (!mention) return;
    const token = `${mentionToken(m.user.name, m.user.id)} `;
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

  const send = async () => {
    if (!body || sending || disabled) return;
    setSending(true);
    const previous = text;
    setText('');
    setDraft(draftKey, '');
    try {
      await onSend(body);
    } catch {
      setText(previous); // keep what was typed; the caller shows the error
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

  return (
    <div className="relative">
      <div
        className={cn(
          'rounded-xl border border-border bg-surface shadow-xs transition-[border-color,box-shadow] duration-micro',
          'focus-within:border-primary focus-within:shadow-focus',
          disabled && 'opacity-60',
        )}
      >
        <textarea
          ref={area}
          rows={1}
          value={text}
          maxLength={MAX_LEN}
          disabled={disabled}
          aria-label={label}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setCaret(e.target.selectionStart);
            setHighlight(0);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          className="block max-h-60 w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-base text-text placeholder:text-text-faint focus:outline-none"
        />
        <div className="flex items-center gap-0.5 px-2 pb-2">
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
              disabled={!body || sending || disabled}
              onClick={() => void send()}
              className={cn(
                hint ? 'ml-auto sm:ml-0' : 'ml-auto',
                body &&
                  !sending &&
                  '!bg-primary-solid !text-on-primary hover:!bg-primary-solid-hover',
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
          className="absolute bottom-full left-2 z-20 mb-1 w-64 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {matches.map((m, i) => (
            <li
              key={m.user.id}
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
              <Avatar size="xs" name={m.user.name} src={m.user.avatarUrl} />
              {m.user.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
