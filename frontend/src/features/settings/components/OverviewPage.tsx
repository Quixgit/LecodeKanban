import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLabels } from '@/features/cards';
import { useCustomFields } from '@/features/custom-fields';
import { RolePill, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { Pill, Skeleton } from '@/shared/ui';
import { useWorkspaceSettings } from '../hooks/useSettings';
import { SECTIONS, type SectionKey } from '../model/sections';

/** The landing page of the admin centre: every area as a tile with a short status, like Integrations. */
export function OverviewPage() {
  const { t } = useTranslation('settings');
  const reduce = useReducedMotion();
  const { workspace, isLoading } = useCurrentWorkspace();
  const fields = useCustomFields(workspace?.id);
  const labels = useLabels(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  const settings = useWorkspaceSettings(workspace?.id);
  if (isLoading || !workspace) return <Skeleton className="h-64" />;

  const f = settings.data?.features;
  const on = f ? Object.values(f).filter(Boolean).length : undefined;
  const status: Partial<Record<SectionKey, string | undefined>> = {
    features: on === undefined ? undefined : t('overview.modulesOn', { on, total: 5 }),
    fields: fields.data ? t('overview.count', { count: fields.data.length }) : undefined,
    labels: labels.data ? t('overview.count', { count: labels.data.length }) : undefined,
    members: members.data ? t('overview.people', { count: members.data.length }) : undefined,
    access: settings.data
      ? settings.data.inviteBy === 'admins'
        ? t('overview.inviteAdmins')
        : t('overview.inviteMembers')
      : undefined,
  };
  const canEdit = workspace.role === 'owner' || workspace.role === 'admin';

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border-subtle bg-surface p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-xl bg-primary-subtle text-lg font-semibold text-primary-ink">
            {workspace.name.slice(0, 1).toUpperCase()}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              {t('overview.eyebrow')}
            </p>
            <h2 className="text-lg font-semibold text-text">{workspace.name}</h2>
            {settings.data?.description && (
              <p className="mt-0.5 max-w-xl text-sm text-text-muted">{settings.data.description}</p>
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

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.filter((s) => s.key !== 'overview').map(
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
