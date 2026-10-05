import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { modKeyLabel } from '@/shared/lib/platform';
import {
  BOARD_KEYS,
  EDITOR_SHORTCUTS,
  GO_SHORTCUTS,
  MARKDOWN_SHORTCUTS,
} from '@/shared/lib/shortcutCatalog';

export interface ShortcutRow {
  keys: readonly string[];
  then?: boolean;
  label: string;
}

export interface ShortcutGroup {
  id: string;
  title: string;
  rows: ShortcutRow[];
}

/** The complete shortcut table (what "?" shows page by page), translated, for the Help page and its search. */
export function useShortcutGroups(): { groups: ShortcutGroup[]; markdown: readonly string[] } {
  const { t } = useTranslation(['help', 'nav', 'kanban', 'wikiEditor']);
  return useMemo(() => {
    const groups: ShortcutGroup[] = [
      {
        id: 'global',
        title: t('help:shortcuts.global'),
        rows: [
          { keys: [modKeyLabel, 'K'], label: t('nav:shortcuts.palette') },
          { keys: ['?'], label: t('nav:shortcuts.help') },
          ...GO_SHORTCUTS.map((g) => ({
            keys: ['G', g.key.toUpperCase()],
            then: true,
            label: t(`nav:shortcuts.go.${g.label}`),
          })),
        ],
      },
      {
        id: 'board',
        title: t('help:shortcuts.board'),
        rows: (['newCard', 'search', 'navigate', 'open', 'drag', 'cancel'] as const).map((a) => ({
          keys: BOARD_KEYS[a],
          label: t(`kanban:shortcuts.${a}`),
        })),
      },
      ...EDITOR_SHORTCUTS.map((g) => ({
        id: `editor-${g.id}`,
        title: `${t('help:shortcuts.editor')} · ${t(`help:shortcuts.groups.${g.id}`)}`,
        rows: g.items.map((i) => ({
          keys: i.keys,
          label: t(`wikiEditor:shortcuts.items.${i.id}`),
        })),
      })),
    ];
    return { groups, markdown: MARKDOWN_SHORTCUTS };
  }, [t]);
}
