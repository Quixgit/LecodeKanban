import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUpRight,
  Check,
  FolderKanban,
  History,
  ListChecks,
  MailPlus,
  ShieldAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useCardStats, useLabels } from '@/features/cards';
import { useCustomFields } from '@/features/custom-fields';
import { useProjectSummary } from '@/features/projects';
import {
  can,
  RolePill,
  useCurrentWorkspace,
  useInvites,
  useRoles,
  useWorkspaceMembers,
} from '@/features/workspaces';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatRelative } from '@/shared/lib/format';
import { Avatar, Card, Pill, ProgressBar, Skeleton, StatCard } from '@/shared/ui';
import { useDescribeAudit } from '../hooks/useDescribeAudit';
import { useAudit, useMailStatus, useWorkspaceSettings } from '../hooks/useSettings';
import { SECTIONS, type SectionKey } from '../model/sections';
import { setupProgress, setupSteps } from '../model/setup';
import { WorkspaceGlyph } from './WorkspaceGlyph';

function Kpi({
  icon,
  label,
  value,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-xl outline-none transition-transform duration-ui hover:-translate-y-0.5 focus-visible:shadow-focus"
    >
      <StatCard icon={icon} label={label} value={value} className="h-full" />
    </Link>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-0">
      <header className="flex items-center gap-2.5 border-b border-border-subtle px-5 py-3.5">
        <Icon className="size-4 stroke-[1.7] text-primary-ink" aria-hidden />
        <h3 className="flex-1 text-sm font-semibold text-text">{title}</h3>
        {action}
      </header>
      <div className="flex-1 px-5 py-4">{children}</div>
    </Card>
  );
}

/** The landing page of the admin centre: where the workspace stands, what to do next, what changed, and every area. */
export function OverviewPage() {
  const { t } = useTranslation('settings');
  const { language } = useLanguage();
  const describe = useDescribeAudit();
  const reduce = useReducedMotion();
  const { workspace, isLoading } = useCurrentWorkspace();
  const ws = workspace?.id;
  const canEdit = !!workspace && can(workspace, 'workspace.update');
  const canSeeAudit = !!workspace && can(workspace, 'audit.view');
  const fields = useCustomFields(ws);
  const labels = useLabels(ws);
  const members = useWorkspaceMembers(ws);
  const invites = useInvites(ws, canEdit);
  const settings = useWorkspaceSettings(ws);
  const roles = useRoles(ws);
  const projects = useProjectSummary(ws);
  const stats = useCardStats(ws, 7);
  const mail = useMailStatus(ws, canEdit);
  const audit = useAudit(ws, canSeeAudit);
  if (isLoading || !workspace) return <Skeleton className="h-64" />;

  const s = settings.data;
  const f = s?.features;
  const on = f ? Object.values(f).filter(Boolean).length : undefined;
  const status: Partial<Record<SectionKey, string | undefined>> = {
    features: on === undefined ? undefined : t('overview.modulesOn', { on, total: 5 }),
    fields: fields.data ? t('overview.count', { count: fields.data.length }) : undefined,
    labels: labels.data ? t('overview.count', { count: labels.data.length }) : undefined,
    members: members.data ? t('overview.people', { count: members.data.length }) : undefined,
    roles: roles.data ? t('overview.roles', { count: roles.data.roles.length }) : undefined,
  };
  const steps = s
    ? setupSteps({
        settings: s,
        members: members.data?.length ?? 1,
        emailLive: mail.data ? !mail.data.capturing : undefined,
        customRoles: roles.data?.roles.filter((r) => r.custom).length,
        changedRoles: roles.data?.roles.filter((r) => r.changed).length,
        fields: fields.data?.length,
        labels: labels.data?.length,
      })
    : [];
  const progress = setupProgress(steps);
  const pending = invites.data?.length;

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card">
        <div className="flex items-center gap-4">
          <WorkspaceGlyph icon={s?.icon ?? 'building'} size="lg" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('overview.eyebrow')}
            </p>
            <h2 className="text-lg font-semibold text-text">{workspace.name}</h2>
            {s?.description && (
              <p className="mt-0.5 max-w-xl text-sm text-text-muted">{s.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-text-muted">
          {t('overview.yourRole')} <RolePill role={workspace.role} />
        </div>
        {!canEdit && (
          <p className="flex w-full items-center gap-2 rounded-lg bg-surface-muted px-3 py-2 text-sm text-text-secondary">
            <ShieldAlert className="size-4 shrink-0 text-progress-ink" aria-hidden />
            {t('readOnly')}
          </p>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          to="/team"
          icon={<Users />}
          label={t('overview.kpi.members')}
          value={members.data?.length ?? '–'}
        />
        <Kpi
          to="/team"
          icon={<MailPlus />}
          label={t('overview.kpi.invites')}
          value={pending ?? '–'}
        />
        <Kpi
          to="/projects"
          icon={<FolderKanban />}
          label={t('overview.kpi.projects')}
          value={projects.data?.total ?? '–'}
        />
        <Kpi
          to="/tasks"
          icon={<ListChecks />}
          label={t('overview.kpi.tasks')}
          value={stats.data?.active ?? '–'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={t('overview.setup.title')}
          icon={Check}
          action={<span className="tabular text-xs font-medium text-text-muted">{progress}%</span>}
        >
          <ProgressBar value={progress} label={t('overview.setup.title')} />
          <ul className="mt-4 flex flex-col gap-1">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  to={step.to}
                  className="group flex items-center gap-3 rounded-lg px-2 py-2 outline-none transition-colors duration-micro hover:bg-surface-muted focus-visible:shadow-focus"
                >
                  <span
                    aria-hidden
                    className={cn(
                      'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-ui',
                      step.done
                        ? 'border-transparent bg-primary-solid text-on-primary'
                        : 'border-border-strong text-transparent',
                    )}
                  >
                    <Check className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        step.done ? 'text-text-muted line-through' : 'text-text',
                      )}
                    >
                      {t(`overview.setup.steps.${step.key}.title`)}
                    </span>
                    {!step.done && (
                      <span className="block text-xs text-text-muted">
                        {t(`overview.setup.steps.${step.key}.hint`)}
                      </span>
                    )}
                  </span>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-text-faint opacity-0 transition-opacity duration-micro group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          title={t('overview.activity.title')}
          icon={History}
          action={
            canSeeAudit ? (
              <Link
                to="/settings/audit"
                className="rounded-md text-xs font-medium text-primary-ink outline-none hover:underline focus-visible:shadow-focus"
              >
                {t('overview.activity.all')}
              </Link>
            ) : undefined
          }
        >
          {!canSeeAudit ? (
            <p className="text-sm text-text-muted">{t('audit.adminsOnly')}</p>
          ) : audit.isPending ? (
            <Skeleton className="h-32" />
          ) : !audit.data?.length ? (
            <p className="text-sm text-text-muted">{t('overview.activity.empty')}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {audit.data.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <Avatar name={e.actor?.name ?? '?'} src={e.actor?.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">
                      <span className="font-medium">{e.actor?.name ?? t('audit.someone')}</span>{' '}
                      {describe(e)}
                    </p>
                    <time dateTime={e.at} className="text-xs text-text-muted">
                      {formatRelative(e.at, language)}
                    </time>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <h3 className="mt-2 text-sm font-semibold text-text">{t('overview.allSettings')}</h3>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.filter((x) => x.key !== 'overview').map(
          ({ key, to, icon: Icon, external }, i) => (
            <motion.li
              key={key}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: reduce ? 0 : i * 0.04 }}
            >
              <Link
                to={to}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card outline-none transition-[border-color,box-shadow,transform] duration-ui hover:-translate-y-0.5 hover:border-primary-border hover:shadow-card-hover focus-visible:shadow-focus"
              >
                <span className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary-ink transition-colors duration-ui group-hover:bg-primary-solid group-hover:text-on-primary [&_svg]:size-5 [&_svg]:stroke-[1.7]">
                    <Icon aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-base font-semibold text-text">
                      {t(`sections.${key}.title`)}
                      {external && (
                        <ArrowUpRight className="size-3.5 text-text-faint" aria-hidden />
                      )}
                    </span>
                    {status[key] && (
                      <Pill size="sm" tone="neutral" className="mt-1">
                        {status[key]}
                      </Pill>
                    )}
                  </span>
                </span>
                <span className="text-sm text-text-muted">{t(`sections.${key}.description`)}</span>
              </Link>
            </motion.li>
          ),
        )}
      </ul>
    </div>
  );
}
