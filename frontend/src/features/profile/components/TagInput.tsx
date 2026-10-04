import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';

interface Props {
  id?: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  max: number;
  maxLength: number;
  placeholder?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
}

/** Type a word and press Enter or a comma to add it as a tag; Backspace on an empty box removes the last. */
export function TagInput({
  id,
  value,
  onChange,
  max,
  maxLength,
  placeholder,
  invalid,
  ...rest
}: Props) {
  const { t } = useTranslation('profile');
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const word = raw.trim().replace(/,$/, '').trim();
    setDraft('');
    if (!word || value.length >= max) return;
    if (value.some((v) => v.toLowerCase() === word.toLowerCase())) return;
    onChange([...value, word.slice(0, maxLength)]);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-control flex-wrap items-center gap-1.5 rounded-lg border bg-surface px-2 py-1.5 transition-[border-color,box-shadow] duration-micro focus-within:border-primary focus-within:shadow-focus',
        invalid ? 'border-danger' : 'border-border hover:border-border-strong',
      )}
    >
      {value.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-subtle pl-3 pr-1.5 text-sm text-primary-ink"
        >
          {tag}
          <button
            type="button"
            aria-label={t('skills.remove', { name: tag })}
            onClick={() => onChange(value.filter((v) => v !== tag))}
            className="grid size-5 place-items-center rounded-full outline-none hover:bg-primary-soft focus-visible:shadow-focus"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        maxLength={maxLength}
        disabled={value.length >= max}
        placeholder={value.length >= max ? t('skills.full', { max }) : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        onBlur={() => add(draft)}
        className="min-w-32 flex-1 bg-transparent px-1 text-base text-text outline-none placeholder:text-text-faint"
        {...rest}
      />
    </div>
  );
}
