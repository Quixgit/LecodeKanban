import { useTranslation } from 'react-i18next';
import {
  EDITOR_SHORTCUTS as GROUPS,
  MARKDOWN_SHORTCUTS as MARKDOWN,
} from '@/shared/lib/shortcutCatalog';
import { Kbd, Modal } from '@/shared/ui';

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { t } = useTranslation('wikiEditor');
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('shortcuts.title')}
      description={t('shortcuts.description')}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.id} aria-labelledby={`sc-${g.id}`}>
            <h3
              id={`sc-${g.id}`}
              className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted"
            >
              {t(`shortcuts.groups.${g.id}`)}
            </h3>
            <dl className="flex flex-col gap-1.5">
              {g.items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3">
                  <dt className="text-base text-text-secondary">{t(`shortcuts.items.${s.id}`)}</dt>
                  <dd className="flex gap-1">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section aria-labelledby="sc-md" className="sm:col-span-2">
          <h3
            id="sc-md"
            className="mb-2 text-xs font-medium uppercase tracking-wide text-text-muted"
          >
            {t('shortcuts.markdown')}
          </h3>
          <p className="mb-2 text-sm text-text-muted">{t('shortcuts.markdownHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {MARKDOWN.map((m) => (
              <Kbd key={m} className="whitespace-pre">
                {m}
              </Kbd>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  );
}
