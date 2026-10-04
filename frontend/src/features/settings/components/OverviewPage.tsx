import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLabels } from '@/features/cards';
import { useCustomFields } from '@/features/custom-fields';
import { RolePill, useCurrentWorkspace, useWorkspaceMembers } from '@/features/workspaces';
import { Skeleton } from '@/shared/ui';
import { SECTIONS, type SectionKey } from '../model/sections';

/** The landing page of the admin centre: every area as a card, with a live count where it makes sense. */
export function OverviewPage() {
  const { t } = useTranslation('settings');
  const reduce = useReducedMotion();
  const { workspace, isLoading } = useCurrentWorkspace();
  const fields = useCustomFields(workspace?.id);
  const labels = useLabels(workspace?.id);
  const members = useWorkspaceMembers(workspace?.id);
  if (isLoading || !workspace) return <Skeleton className="h-64" />;

  const counts: Partial<Record<SectionKey, number | undefined>> = {
    fields: fields.data?.length,
    labels: labels.data?.length,
    members: members.data?.length,
  };
  const canEdit = workspace.role === 'owner' || workspace.role === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <section className="overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-primary-subtle via-surface to-surface p-6 shadow-xs">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary-ink">
          {t('overview.eyebrow')}
        </p>
        <h2 className="mt-1 text-xl font-semibold text-text">{workspace.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-muted">
          {t('overview.yourRole')} <RolePill role={workspace.role} />
        </p>
        {!canEdit && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-surface/70 px-3 py-2 text-sm text-text-secondary">
            <ShieldAlert className="size-4 shrink-0 text-progress-ink" aria-hidden />
            {t('overview.readOnly')}
          </p>
        )}
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.filter((s) => s.key !== 'overview').map(({ key, to, icon: Icon }, i) => (
          <motion.li
            key={key}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.05 }}
          >
            <Link
              to={to}
              className="group flex h-full flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-5 shadow-xs outline-none transition-[border-color,box-shadow,transform] duration-ui hover:-translate-y-0.5 hover:border-primary-border hover:shadow-card-hover focus-visible:shadow-focus"
            >
              <span className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-subtle text-primary-ink transition-colors duration-ui group-hover:bg-primary-solid group-hover:text-on-primary">
                  <Icon className="size-5 stroke-[1.7]" aria-hidden />
                </span>
                {counts[key] !== undefined && (
                  <span className="tabular rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                    {counts[key]}
                  </span>
                )}
              </span>
              <span>
                <span className="block text-base font-semibold text-text">
                  {t(`sections.${key}.title`)}
                </span>
                <span className="mt-0.5 block text-sm text-text-muted">
                  {t(`sections.${key}.description`)}
                </span>
              </span>
              <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary-ink">
                {t('overview.open')}
                <ArrowRight
                  className="size-4 transition-transform duration-ui group-hover:translate-x-1"
                  aria-hidden
                />
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
