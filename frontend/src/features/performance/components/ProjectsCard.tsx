import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle, EmptyState, TrendChip } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { changePct } from '../model/format';

/** One row per project: how far along it is, what is overdue, and how fast it moved against the previous period. */
export function ProjectsCard({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation('performance');
  const reduce = useReducedMotion();
  return (
    <Card className="p-5">
      <CardHeader>
        <div>
          <CardTitle>{t('projects.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('projects.subtitle')}</p>
        </div>
      </CardHeader>
      {report.projects.length === 0 ? (
        <EmptyState className="py-8" title={t('projects.empty')} />
      ) : (
        <ul className="flex flex-col gap-4">
          {report.projects.map((p, i) => {
            const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
            const speed = changePct(p.doneInPeriod, p.donePrevious);
            return (
              <li key={p.project.id}>
                <Link to={`/tasks?projectId=${p.project.id}`} className="group block rounded-md">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium text-text group-hover:text-primary">
                      {p.project.name}
                    </span>
                    <span className="tabular shrink-0 text-sm text-text-secondary">{pct}%</span>
                  </span>
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-surface-sunken">
                    <motion.span
                      className="block h-full origin-left rounded-full bg-series-done"
                      style={{ width: `${pct}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...transition.large, duration: 0.6, delay: i * 0.05 }}
                    />
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                    <span>{t('projects.progress', { done: p.done, total: p.total })}</span>
                    {p.overdue > 0 && (
                      <span className="text-danger-ink">
                        {t('projects.overdue', { count: p.overdue })}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      {t('projects.speed', { count: p.doneInPeriod })}
                      {speed !== null && (
                        <TrendChip value={speed} format={(n) => `${Math.round(n)}%`} />
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
