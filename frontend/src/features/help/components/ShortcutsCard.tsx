import { Fragment, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, Kbd } from '@/shared/ui';
import { useShortcutGroups } from '../hooks/useShortcutGroups';

/** The full shortcut table with a filter; the "?" dialog on each page shows the part that works there. */
export function ShortcutsCard() {
  const { t } = useTranslation('help');
  const { groups, markdown } = useShortcutGroups();
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) =>
          `${r.label} ${r.keys.join(' ')}`.toLocaleLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [groups, filter]);

  return (
    <Card className="p-5" id="shortcuts">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>{t('shortcuts.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('shortcuts.subtitle')}</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted"
            aria-hidden
          />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t('shortcuts.filter')}
            placeholder={t('shortcuts.filter')}
            className="h-control w-full rounded-lg border border-border bg-surface pl-9 pr-3 text-base text-text placeholder:text-text-muted focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
          />
        </div>
      </CardHeader>
      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-secondary">{t('shortcuts.none')}</p>
      ) : (
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((g) => (
            <section key={g.id} aria-labelledby={`hs-${g.id}`}>
              <h3
                id={`hs-${g.id}`}
                className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                {g.title}
              </h3>
              <dl className="flex flex-col gap-1.5">
                {g.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <dt className="text-sm text-text-secondary">{r.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {r.keys.map((k, n) => (
                        <Fragment key={n}>
                          {r.then && n > 0 && (
                            <span className="text-xs text-text-muted">{t('shortcuts.then')}</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          {!filter.trim() && (
            <section aria-labelledby="hs-md" className="md:col-span-2 xl:col-span-3">
              <h3
                id="hs-md"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted"
              >
                {t('shortcuts.markdown')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {markdown.map((m) => (
                  <Kbd key={m} className="whitespace-pre">
                    {m}
                  </Kbd>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Card>
  );
}
