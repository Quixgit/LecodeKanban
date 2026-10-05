import { motion } from 'framer-motion';
import { FilePlus2, Trash2 } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { STATUSES, useCardCounts } from '@/features/cards';
import { useModules } from '@/features/integrations';
import { ProjectGlyph, useAllProjects } from '@/features/projects';
import { GROUPS, SECTIONS } from '@/features/settings';
import { useCurrentWorkspace } from '@/features/workspaces';
import { cn } from '@/shared/lib/cn';
import { fadeUp, transition } from '@/shared/motion';
import { useShellLayout } from '@/shared/lib/shellLayout';
import { ownsList } from './railPanels';
import { statusTone, toneClasses, type TaskStatus } from '@/shared/ui';

const ACTIVE_ID = 'panel-active-item';

/** In a drawer the highlight must not be a shared-layout element: it would keep the closing drawer on screen. */
const PlainHighlight = createContext(false);

function PanelLink({
  to,
  end,
  lead,
  children,
  trail,
}: {
  to: string;
  end?: boolean;
  lead?: ReactNode;
  children: ReactNode;
  trail?: ReactNode;
}) {
  const plain = useContext(PlainHighlight);
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          cn(
            'relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-md outline-none transition-colors duration-micro focus-visible:shadow-focus',
            isActive
              ? 'font-medium text-primary-ink'
              : 'text-text-secondary hover:bg-surface-sunken hover:text-text',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive &&
              (plain ? (
                <span aria-hidden className="absolute inset-0 rounded-lg bg-primary-subtle" />
              ) : (
                <motion.span
                  layoutId={ACTIVE_ID}
                  transition={transition.spring}
                  aria-hidden
                  className="absolute inset-0 rounded-lg bg-primary-subtle"
                />
              ))}
            {lead && <span className="relative flex shrink-0 [&_svg]:size-4">{lead}</span>}
            <span className="relative min-w-0 flex-1 truncate">{children}</span>
            {trail && <span className="tabular relative text-xs text-text-muted">{trail}</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      {title && (
        <h3 className="px-2.5 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
          {title}
        </h3>
      )}
      <ul className="flex flex-col gap-0.5">{children}</ul>
    </div>
  );
}

function TasksMenu() {
  const { t } = useTranslation('nav');
  const { workspace } = useCurrentWorkspace();
  const counts = useCardCounts(workspace?.id, {}).data;
  const slug: Record<TaskStatus, string> = {
    todo: 'todo',
    in_progress: 'in-progress',
    in_review: 'in-review',
    done: 'completed',
  };
  return (
    <Group>
      <PanelLink to="/tasks" end>
        {t('panel.allTasks')}
      </PanelLink>
      {STATUSES.map((s) => (
        <PanelLink
          key={s}
          to={`/tasks/${slug[s]}`}
          lead={
            <span
              aria-hidden
              className={cn('size-2 rounded-full', toneClasses[statusTone[s]].fill)}
            />
          }
          trail={counts?.[s]}
        >
          {t(`tasks.${s}`)}
        </PanelLink>
      ))}
      <PanelLink to="/templates" lead={<FilePlus2 aria-hidden />}>
        {t('panel.templates')}
      </PanelLink>
      <PanelLink to="/trash" lead={<Trash2 aria-hidden />}>
        {t('panel.trash')}
      </PanelLink>
    </Group>
  );
}

function ProjectsMenu() {
  const { t } = useTranslation('nav');
  const { workspace } = useCurrentWorkspace();
  const projects = useAllProjects(workspace?.id).data?.items ?? [];
  return (
    <>
      <Group>
        <PanelLink to="/projects" end>
          {t('panel.allProjects')}
        </PanelLink>
      </Group>
      {projects.length > 0 && (
        <Group title={t('panel.yourProjects')}>
          {projects.map((p) => (
            <PanelLink
              key={p.id}
              to={`/tasks?projectId=${p.id}`}
              lead={<ProjectGlyph icon={p.icon} tone={p.tone} size="sm" />}
            >
              {p.name}
            </PanelLink>
          ))}
        </Group>
      )}
    </>
  );
}

function IntegrationsMenu() {
  const { t } = useTranslation('nav');
  const { modules } = useModules();
  return (
    <>
      <Group>
        <PanelLink to="/integrations" end>
          {t('panel.allIntegrations')}
        </PanelLink>
      </Group>
      <Group title={t('panel.modules')}>
        {modules.map((m) => (
          <PanelLink
            key={m.id}
            to={m.to}
            lead={<m.icon aria-hidden />}
            trail={
              <span
                aria-hidden
                className={cn(
                  'block size-2 rounded-full',
                  m.where === 'active' ? 'bg-done' : 'bg-border-strong',
                )}
              />
            }
          >
            {m.name}
          </PanelLink>
        ))}
      </Group>
    </>
  );
}

function SettingsMenu() {
  const { t } = useTranslation('settings');
  return (
    <>
      {GROUPS.map((g) => (
        <Group key={g} title={t(`groups.${g}`)}>
          {SECTIONS.filter((s) => s.group === g).map(({ key, to, icon: Icon, external }) => (
            <PanelLink key={key} to={to} end={key === 'overview'} lead={<Icon aria-hidden />}>
              {t(`sections.${key}.title`)}
              {external ? ' ↗' : ''}
            </PanelLink>
          ))}
        </Group>
      ))}
    </>
  );
}

/** An empty column the page itself fills (chat channels, the docs tree) through a portal. */
function OwnList() {
  const setSlot = useShellLayout((s) => s.setSlot);
  return <div ref={setSlot} className="h-full" />;
}

const MENUS: Record<string, () => ReactNode> = {
  tasks: TasksMenu,
  projects: ProjectsMenu,
  integrations: IntegrationsMenu,
  settings: SettingsMenu,
};

/** The menu for the section you are in: what is inside it, one click away. */
export function SectionPanel({ itemKey, plain = false }: { itemKey: string; plain?: boolean }) {
  const { t } = useTranslation('nav');
  if (ownsList(itemKey)) return <OwnList />;
  const Menu = MENUS[itemKey];
  if (!Menu) return null;
  return (
    <nav aria-label={t(`items.${itemKey}`)} className="flex h-full flex-col">
      <h2 className="flex h-header shrink-0 items-center px-5 text-md font-semibold text-text">
        {t(`items.${itemKey}`)}
      </h2>
      <motion.div
        key={itemKey}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="min-h-0 flex-1 overflow-y-auto px-3 pb-4"
      >
        <PlainHighlight.Provider value={plain}>
          <Menu />
        </PlainHighlight.Provider>
      </motion.div>
    </nav>
  );
}
