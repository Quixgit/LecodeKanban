import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Command, LayoutPanelLeft, Search, X } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { transition } from '@/shared/motion';
import { Card } from '@/shared/ui';
import { useHelpIndex } from '../hooks/useHelpIndex';
import { searchHelp, type HelpHitKind } from '../model/search';

const ICON = { guide: BookOpen, shortcut: Command, page: LayoutPanelLeft } as const;
const ORDER: HelpHitKind[] = ['guide', 'shortcut', 'page'];
const MAX_PER_GROUP = 6;

/** The search field at the top and, while there is a query, the results grouped by kind. */
export function SearchBox({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  const { t } = useTranslation('help');
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const index = useHelpIndex();
  const hits = useMemo(() => searchHelp(index, query), [index, query]);
  const active = query.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('hero.placeholder')}
          aria-label={t('hero.placeholder')}
          className="h-12 w-full rounded-xl border border-border bg-surface pl-12 pr-11 text-base text-text shadow-xs placeholder:text-text-muted hover:border-primary/30 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {active && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label={t('hero.clear')}
            className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-text-muted hover:bg-surface-sunken hover:text-text"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {active && (
          <motion.div
            key="results"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transition.ui}
            className="mt-3"
          >
            <Card className="p-2" role="region" aria-label={t('results.groups.guide')}>
              <p className="sr-only" role="status">
                {hits.length === 0
                  ? t('results.none', { q: query })
                  : t('results.count', { count: hits.length })}
              </p>
              {hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-text-secondary">
                  {t('results.none', { q: query })}
                </p>
              ) : (
                ORDER.map((kind) => {
                  const group = hits.filter((h) => h.kind === kind).slice(0, MAX_PER_GROUP);
                  if (group.length === 0) return null;
                  const Icon = ICON[kind];
                  return (
                    <section key={kind} className="py-1">
                      <h3 className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
                        {t(`results.groups.${kind}`)}
                      </h3>
                      <ul>
                        {group.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => {
                                if (h.to.startsWith('/help')) {
                                  onQuery('');
                                }
                                navigate(h.to);
                              }}
                              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none"
                            >
                              <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-text">
                                  {h.title}
                                </span>
                                {h.hint && (
                                  <span className="block truncate text-xs text-text-muted">
                                    {h.hint}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
