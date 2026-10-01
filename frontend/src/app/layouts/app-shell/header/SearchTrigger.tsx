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
      className="hidden h-10 w-full max-w-[420px] items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-left text-base text-text-faint shadow-xs transition-[border-color] duration-micro hover:border-border-strong md:flex"
    >
      <Search className="size-[18px] stroke-[1.6] text-text-muted" aria-hidden />
      <span className="flex-1 truncate">{t('search.placeholder')}</span>
      <Kbd>{modKeyLabel} K</Kbd>
    </button>
  );
}
