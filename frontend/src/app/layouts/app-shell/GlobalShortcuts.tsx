import { Fragment, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHotkey } from '@/shared/hooks/useHotkey';
import { modKeyLabel } from '@/shared/lib/platform';
import { useShortcutHelp, useShortcutSection } from '@/shared/lib/shortcutHelp';
import { Kbd, Modal } from '@/shared/ui';

/** "g" then a letter jumps to a page. */
const GO: { key: string; to: string; label: string }[] = [
  { key: 'd', to: '/', label: 'dashboard' },
  { key: 'p', to: '/projects', label: 'projects' },
  { key: 't', to: '/tasks', label: 'tasks' },
  { key: 'l', to: '/calendar', label: 'calendar' },
  { key: 'c', to: '/chat', label: 'chat' },
  { key: 'o', to: '/docs', label: 'docs' },
  { key: 'm', to: '/team', label: 'team' },
  { key: 's', to: '/settings', label: 'settings' },
];

const WINDOW_MS = 1200;

function GoTo() {
  const navigate = useNavigate();
  useEffect(() => {
    let armedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      )
        return;
      const k = e.key.toLowerCase();
      if (k === 'g') {
        armedAt = Date.now();
        return;
      }
      const hit = GO.find((g) => g.key === k);
      if (hit && Date.now() - armedAt <= WINDOW_MS) {
        armedAt = 0;
        e.preventDefault();
        navigate(hit.to);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
  return null;
}

/** The "?" dialog and the shortcuts that work on every page. */
export function GlobalShortcuts() {
  const { t } = useTranslation('nav');
  const open = useShortcutHelp((s) => s.open);
  const setOpen = useShortcutHelp((s) => s.setOpen);
  const sections = useShortcutHelp((s) => s.sections);
  useHotkey('?', () => setOpen(true), { shift: true });
  useShortcutSection('global', {
    title: t('shortcuts.everywhere'),
    items: [
      { keys: [modKeyLabel, 'K'], label: t('shortcuts.palette') },
      { keys: ['?'], label: t('shortcuts.help') },
      ...GO.map((g) => ({
        keys: ['G', g.key.toUpperCase()],
        then: true,
        label: t(`shortcuts.go.${g.label}`),
      })),
    ],
  });
  const ordered = Object.entries(sections).sort(([a], [b]) =>
    a === 'global' ? 1 : b === 'global' ? -1 : a.localeCompare(b),
  );

  return (
    <>
      <GoTo />
      <Modal
        open={open}
        onOpenChange={setOpen}
        size="md"
        title={t('shortcuts.title')}
        description={t('shortcuts.description')}
      >
        <div className="flex flex-col gap-6">
          {ordered.map(([id, s]) => (
            <section key={id} aria-label={s.title}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {s.title}
              </h3>
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2.5 text-sm">
                {s.items.map((it) => (
                  <Fragment key={it.label + it.keys.join('+')}>
                    <dt className="flex items-center gap-1">
                      {it.keys.map((k, i) => (
                        <Fragment key={k + i}>
                          {i > 0 && it.then && (
                            <span className="text-xs text-text-muted">{t('shortcuts.then')}</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </Fragment>
                      ))}
                    </dt>
                    <dd className="text-text-secondary">{it.label}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Modal>
    </>
  );
}
