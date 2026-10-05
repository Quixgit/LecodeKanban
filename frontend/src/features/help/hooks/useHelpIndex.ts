import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { can, useCurrentWorkspace } from '@/features/workspaces';
import { helpPath } from '@/shared/lib/helpPath';
import { GUIDES } from '../model/content';
import type { HelpEntry } from '../model/search';
import { useShortcutGroups } from './useShortcutGroups';

/** Pages worth finding by name; permission-gated ones only for people who may open them. */
const PAGES = [
  { key: 'dashboard', to: '/' },
  { key: 'projects', to: '/projects' },
  { key: 'calendar', to: '/calendar' },
  { key: 'tasks', to: '/tasks' },
  { key: 'chat', to: '/chat' },
  { key: 'docs', to: '/docs' },
  { key: 'performance', to: '/performance', needs: 'analytics.view' as const },
  { key: 'team', to: '/team' },
  { key: 'integrations', to: '/integrations' },
  { key: 'settings', to: '/settings' },
];

/** Everything the Help search can find, in the reader's language. */
export function useHelpIndex(): HelpEntry[] {
  const { t } = useTranslation(['help', 'nav']);
  const { workspace } = useCurrentWorkspace();
  const { groups } = useShortcutGroups();
  const analytics = can(workspace, 'analytics.view');
  return useMemo(() => {
    const entries: HelpEntry[] = [];
    for (const g of GUIDES) {
      for (const a of g.articles) {
        const base = `help:guides.items.${g.id}.articles.${a}`;
        const steps = t(`${base}.steps`, { returnObjects: true }) as string[];
        entries.push({
          id: `guide-${g.id}-${a}`,
          kind: 'guide',
          title: t(`${base}.title`),
          hint: t(`help:guides.items.${g.id}.title`),
          body: `${t(`${base}.summary`)} ${t(`${base}.keywords`)} ${steps.join(' ')}`,
          to: helpPath(g.id, a),
        });
      }
    }
    for (const g of groups) {
      g.rows.forEach((r, i) =>
        entries.push({
          id: `shortcut-${g.id}-${i}`,
          kind: 'shortcut',
          title: r.label,
          hint: `${g.title} · ${r.keys.join(r.then ? ` ${t('help:shortcuts.then')} ` : ' + ')}`,
          body: r.keys.join(' '),
          to: '/help#shortcuts',
        }),
      );
    }
    for (const p of PAGES) {
      if (p.needs && !analytics) continue;
      entries.push({
        id: `page-${p.key}`,
        kind: 'page',
        title: t(`nav:items.${p.key}`),
        hint: t(`nav:pages.${p.key}.subtitle`, { defaultValue: '' }),
        body: p.key,
        to: p.to,
      });
    }
    return entries;
  }, [t, groups, analytics]);
}
