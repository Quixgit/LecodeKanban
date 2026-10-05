import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { Avatar, Card, CardHeader, CardTitle, EmptyState } from '@/shared/ui';
import type { PerformanceReport } from '../api/performanceApi';
import { Legend } from './ChartParts';

/** Open and closed tasks per person, side by side: it shows imbalance, it is not a leaderboard (sorted by open load, not by results). */
export function WorkloadCard({ report }: { report: PerformanceReport }) {
  const { t } = useTranslation('performance');
  const reduce = useReducedMotion();
  const max = Math.max(1, ...report.people.flatMap((p) => [p.open, p.done]));
  return (
    <Card className="p-5">
      <CardHeader>
        <div>
          <CardTitle>{t('workload.title')}</CardTitle>
          <p className="text-sm text-text-muted">{t('workload.subtitle')}</p>
        </div>
      </CardHeader>
      {report.people.length === 0 ? (
        <EmptyState className="py-8" title={t('workload.empty')} />
      ) : (
        <>
          <Legend
            label={t('workload.title')}
            items={[
              { swatch: 'bg-series-progress', label: t('workload.open') },
              { swatch: 'bg-series-done', label: t('workload.done') },
            ]}
          />
          <ul className="flex flex-col gap-4">
            {report.people.map((p, i) => (
              <li
                key={p.person.id}
                className="grid grid-cols-[minmax(0,9rem)_1fr] items-start gap-3"
              >
                <span className="flex min-w-0 items-center gap-2 pt-px">
                  <Avatar name={p.person.name} src={p.person.avatarUrl} size="xs" />
                  <span className="truncate text-sm text-text-secondary">{p.person.name}</span>
                </span>
                <span className="flex flex-col gap-1.5">
                  {(
                    [
                      ['open', p.open, 'bg-series-progress'],
                      ['done', p.done, 'bg-series-done'],
                    ] as const
                  ).map(([kind, value, bg], row) => (
                    <span key={kind} className="flex items-center gap-2">
                      <span className="h-2.5 flex-1 overflow-hidden">
                        <motion.span
                          className={`block h-full origin-left rounded-r-[4px] ${bg}`}
                          style={{ width: `${(value / max) * 100}%` }}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{
                            ...transition.large,
                            duration: 0.6,
                            delay: i * 0.04 + row * 0.05,
                          }}
                        />
                      </span>
                      <span className="tabular w-7 text-right text-sm font-medium text-text">
                        {value}
                      </span>
                    </span>
                  ))}
                  {p.overdue > 0 && (
                    <span className="text-xs text-danger-ink">
                      {t('workload.overdue', { count: p.overdue })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.unassignedOpen > 0 && (
        <p className="mt-4 text-sm text-text-muted">
          {t('workload.unassigned', { count: report.unassignedOpen })}
        </p>
      )}
    </Card>
  );
}
