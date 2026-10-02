import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type { Member } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { activeMention, mentionToken } from '@/shared/lib/mentions';
import { Avatar } from '@/shared/ui';

interface Props {
  value: string;
  onChange: (v: string) => void;
  members: Member[];
  placeholder: string;
  label: string;
  onSubmit: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

/** Textarea with "@" autocomplete over workspace members; inserts @[Name](id) tokens. */
export const MentionTextarea = forwardRef<HTMLTextAreaElement, Props>(function MentionTextarea(
  { value, onChange, members, placeholder, label, onSubmit, onCancel, autoFocus },
  ref,
) {
  const area = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => area.current!);
  const [caret, setCaret] = useState(0);
  const [highlight, setHighlight] = useState(0);
  const mention = activeMention(value, caret);
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return members.filter((m) => m.user.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, members]);
  const open = matches.length > 0;

  const pick = (m: Member) => {
    if (!mention) return;
    const token = `${mentionToken(m.user.name, m.user.id)} `;
    const next = value.slice(0, mention.start) + token + value.slice(caret);
    const pos = mention.start + token.length;
    onChange(next);
    setCaret(pos);
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape' && onCancel) {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={area}
        autoFocus={autoFocus}
        rows={3}
        maxLength={10000}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart);
          setHighlight(0);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        className="min-h-20 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-base text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {open && (
        <ul
          role="listbox"
          className="absolute left-2 top-full z-20 mt-1 w-64 rounded-lg border border-border bg-surface p-1 shadow-lg"
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
});
