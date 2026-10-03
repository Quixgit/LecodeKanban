import { useTranslation } from 'react-i18next';
import { modKeyLabel } from '@/shared/lib/platform';
import { Kbd, Modal } from '@/shared/ui';

const MOD = modKeyLabel;
const ALT = 'Alt';
const SHIFT = '⇧';

/** keys per shortcut id; labels come from the wikiEditor translations. */
const GROUPS: { id: string; items: { id: string; keys: string[] }[] }[] = [
  {
    id: 'text',
    items: [
      { id: 'bold', keys: [MOD, 'B'] },
      { id: 'italic', keys: [MOD, 'I'] },
      { id: 'underline', keys: [MOD, 'U'] },
      { id: 'strike', keys: [MOD, SHIFT, 'S'] },
      { id: 'code', keys: [MOD, 'E'] },
      { id: 'highlight', keys: [MOD, SHIFT, 'H'] },
      { id: 'link', keys: [MOD, 'K'] },
      { id: 'paragraph', keys: [MOD, ALT, '0'] },
      { id: 'heading', keys: [MOD, ALT, '1–4'] },
    ],
  },
  {
    id: 'blocks',
    items: [
      { id: 'slash', keys: ['/'] },
      { id: 'bullet', keys: [MOD, SHIFT, '8'] },
      { id: 'ordered', keys: [MOD, SHIFT, '7'] },
      { id: 'task', keys: [MOD, SHIFT, '9'] },
      { id: 'quote', keys: [MOD, SHIFT, 'B'] },
      { id: 'codeBlock', keys: [MOD, ALT, 'C'] },
      { id: 'indent', keys: ['Tab'] },
      { id: 'outdent', keys: [SHIFT, 'Tab'] },
    ],
  },
  {
    id: 'editing',
    items: [
      { id: 'undo', keys: [MOD, 'Z'] },
      { id: 'redo', keys: [MOD, SHIFT, 'Z'] },
      { id: 'plain', keys: [MOD, SHIFT, 'V'] },
      { id: 'hardBreak', keys: [SHIFT, 'Enter'] },
    ],
  },
];

const MARKDOWN = ['# ', '## ', '- ', '1. ', '[] ', '> ', '```', '---', '**x**', '`x`'];

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
