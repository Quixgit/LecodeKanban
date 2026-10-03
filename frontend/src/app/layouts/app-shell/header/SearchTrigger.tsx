import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCommandPalette } from '@/features/command-palette';
import { modKeyLabel } from '@/shared/lib/platform';
import { Kbd } from '@/shared/ui';

/** Looks like the header search input; opens the ⌘K command palette. */
export function SearchTrigger() {
  const { t } = useTranslation();
  const open = useCommandPalette((s) => s.open);
  return (
    <button
      type="button"
      onClick={open}
      aria-keyshortcuts="Meta+K Control+K"
      aria-label={t('search.placeholder')}
      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-left text-base text-text-faint shadow-xs transition-[border-color] duration-micro hover:border-border-strong md:flex 2xl:w-full 2xl:max-w-[420px] 2xl:justify-start 2xl:gap-2.5 2xl:px-3"
    >
      <Search className="size-[18px] stroke-[1.6] text-text-muted" aria-hidden />
      <span className="hidden flex-1 truncate 2xl:block">{t('search.placeholder')}</span>
      <Kbd className="hidden 2xl:inline-flex">{modKeyLabel} K</Kbd>
    </button>
  );
}
