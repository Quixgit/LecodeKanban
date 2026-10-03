import {
  Clock,
  Dumbbell,
  Flag,
  Hand,
  Leaf,
  Lightbulb,
  Plane,
  Search,
  Shapes,
  Smile,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui';
import {
  EMOJI_GROUPS,
  QUICK_REACTIONS,
  loadEmoji,
  searchEmoji,
  withTone,
  type Emoji,
  type EmojiGroup,
} from '../model/emoji';

const GROUP_ICONS: Record<EmojiGroup, LucideIcon> = {
  0: Smile,
  1: Hand,
  3: Leaf,
  4: Utensils,
  5: Plane,
  6: Dumbbell,
  7: Lightbulb,
  8: Shapes,
  9: Flag,
};

const RECENT_KEY = 'lk.emoji.recent';
const TONE_KEY = 'lk.emoji.tone';
const RECENT_MAX = 24;
const TONES = [0, 1, 2, 3, 4, 5] as const;
/** Swatches for the skin-tone picker: the default yellow, then light to dark. */
const TONE_SWATCH = ['👋', '👋🏻', '👋🏼', '👋🏽', '👋🏾', '👋🏿'];

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}
function readTone(): number {
  try {
    const n = Number(localStorage.getItem(TONE_KEY));
    return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 0;
  } catch {
    return 0;
  }
}

/** Slack-style emoji picker: search, categories, frequently used, skin tones. */
export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { t, i18n } = useTranslation('chat');
  const [all, setAll] = useState<Emoji[] | null>(null);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(readRecent);
  const [tone, setTone] = useState(readTone);
  const [hover, setHover] = useState<Emoji | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    let live = true;
    void loadEmoji(i18n.language).then((list) => live && setAll(list));
    return () => {
      live = false;
    };
  }, [i18n.language]);

  const byChar = useMemo(() => new Map((all ?? []).map((e) => [e.unicode, e])), [all]);
  const found = useMemo(() => (all && query.trim() ? searchEmoji(all, query) : null), [all, query]);
  const byGroup = useMemo(() => {
    const m = new Map<number, Emoji[]>();
    for (const e of all ?? []) m.set(e.group, [...(m.get(e.group) ?? []), e]);
    return m;
  }, [all]);

  const pick = (e: Emoji | string) => {
    const char = typeof e === 'string' ? e : withTone(e, tone);
    const next = [char, ...recent.filter((x) => x !== char)].slice(0, RECENT_MAX);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // Frequently used is a convenience; the pick still goes through.
    }
    onPick(char);
  };
  const chooseTone = (n: number) => {
    setTone(n);
    try {
      localStorage.setItem(TONE_KEY, String(n));
    } catch {
      // Same: only a convenience.
    }
  };
  const jump = (g: number) => sections.current.get(g)?.scrollIntoView({ block: 'start' });

  const cell = (e: Emoji) => {
    const char = withTone(e, tone);
    return (
      <button
        key={e.unicode}
        type="button"
        aria-label={e.label}
        title={e.label}
        onMouseEnter={() => setHover(e)}
        onFocus={() => setHover(e)}
        onClick={() => pick(e)}
        className="grid size-8 place-items-center rounded-md text-xl leading-none outline-none transition-colors duration-micro hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        {char}
      </button>
    );
  };

  return (
    <div className="flex h-[22rem] w-[19.5rem] flex-col">
      <div className="flex items-center gap-0.5 border-b border-border-subtle px-2 pt-1.5">
        {recent.length > 0 && (
          <TabButton label={t('emoji.recent')} onClick={() => jump(-1)} icon={Clock} />
        )}
        {EMOJI_GROUPS.map((g) => (
          <TabButton
            key={g}
            label={t(`emoji.groups.${g}`)}
            onClick={() => jump(g)}
            icon={GROUP_ICONS[g]}
          />
        ))}
      </div>
      <div className="px-2.5 pb-1 pt-2.5">
        <label className="relative block">
          <span className="sr-only">{t('emoji.search')}</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-faint"
            aria-hidden
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('emoji.search')}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-sm text-text outline-none placeholder:text-text-faint focus:border-primary/50 focus-visible:shadow-none"
          />
        </label>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2"
        role="group"
        aria-label={t('emoji.label')}
      >
        {!all ? (
          <div className="grid grid-cols-8 gap-1 pt-2" aria-busy>
            {Array.from({ length: 32 }, (_, i) => (
              <Skeleton key={i} className="size-8" />
            ))}
          </div>
        ) : found ? (
          found.length === 0 ? (
            <p className="px-1 py-8 text-center text-sm text-text-muted">
              {t('emoji.none', { q: query })}
            </p>
          ) : (
            <div className="grid grid-cols-8 gap-0.5 pt-1">{found.map(cell)}</div>
          )
        ) : (
          <>
            {recent.length > 0 && (
              <Section id={-1} title={t('emoji.recent')} sections={sections}>
                {recent.map((c) => {
                  const e = byChar.get(c);
                  return e ? (
                    cell({ ...e, unicode: e.unicode })
                  ) : (
                    <button
                      key={c}
                      type="button"
                      aria-label={c}
                      onClick={() => pick(c)}
                      className="grid size-8 place-items-center rounded-md text-xl leading-none outline-none hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {c}
                    </button>
                  );
                })}
              </Section>
            )}
            {EMOJI_GROUPS.map((g) => (
              <Section key={g} id={g} title={t(`emoji.groups.${g}`)} sections={sections}>
                {(byGroup.get(g) ?? []).map(cell)}
              </Section>
            ))}
          </>
        )}
      </div>
      <div className="flex h-11 items-center gap-2 border-t border-border-subtle px-3">
        <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
          {hover ? (
            <>
              <span className="mr-2 text-xl leading-none">{withTone(hover, tone)}</span>
              {hover.label}
            </>
          ) : (
            <span className="text-text-muted">{t('emoji.hint')}</span>
          )}
        </span>
        <div role="radiogroup" aria-label={t('emoji.skinTone')} className="flex shrink-0 gap-0.5">
          {TONES.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={tone === n}
              aria-label={t('emoji.tone', { n })}
              onClick={() => chooseTone(n)}
              className={cn(
                'grid size-6 place-items-center rounded-md text-sm leading-none outline-none transition-colors duration-micro focus-visible:ring-2 focus-visible:ring-primary/40',
                tone === n
                  ? 'bg-primary-soft ring-1 ring-primary-border'
                  : 'hover:bg-surface-sunken',
              )}
            >
              {TONE_SWATCH[n]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** The eight quick reactions as one row (also used standalone above the full picker). */
export function QuickReactions({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation('chat');
  return (
    <div className="flex gap-0.5" role="group" aria-label={t('emoji.quick')}>
      {QUICK_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={e}
          onClick={() => onPick(e)}
          className="grid size-9 place-items-center rounded-lg text-xl leading-none outline-none transition-transform duration-micro hover:scale-110 hover:bg-surface-sunken focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

function TabButton({
  label,
  onClick,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-text-muted outline-none transition-colors duration-micro hover:bg-surface-sunken hover:text-text focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <Icon className="size-4 stroke-[1.7]" aria-hidden />
    </button>
  );
}

function Section({
  id,
  title,
  sections,
  children,
}: {
  id: number;
  title: string;
  sections: React.MutableRefObject<Map<number, HTMLElement>>;
  children: React.ReactNode;
}) {
  return (
    <section
      ref={(el) => {
        if (el) sections.current.set(id, el);
        else sections.current.delete(id);
      }}
      aria-label={title}
    >
      <h3 className="sticky top-0 z-[1] bg-surface py-1.5 text-xs font-semibold text-text-muted">
        {title}
      </h3>
      <div className="grid grid-cols-8 gap-0.5">{children}</div>
    </section>
  );
}
