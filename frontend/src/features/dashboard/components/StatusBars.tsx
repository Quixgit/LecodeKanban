import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { STATUSES, statusToSlug, type StatusCounts } from '@/features/cards';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle, EmptyState } from '@/shared/ui';
import { seriesBg } from './series';

/** Tasks by status: horizontal bars, value at the tip, each row links to the filtered list. */
export function StatusBars({ counts }: { counts: StatusCounts }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const reduce = useReducedMotion();
  const max = Math.max(1, ...STATUSES.map((s) => counts[s]));
  const total = STATUSES.reduce((n, s) => n + counts[s], 0);
  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>{t('statusChart.title')}</CardTitle>
        <span className="tabular text-sm text-text-muted">
          {total} {t('statusChart.total')}
        </span>
      </CardHeader>
      {total === 0 ? (
        <EmptyState className="py-6" title={t('statusChart.empty')} />
      ) : (
        <ul className="flex flex-col gap-3.5">
          {STATUSES.map((s) => (
            <li key={s}>
              <Link
                to={`/tasks/${statusToSlug(s)}`}
                className="group grid grid-cols-[7.5rem_1fr] items-center gap-3 rounded-md"
              >
                <span className="truncate text-sm text-text-secondary group-hover:text-text">
                  {t(`common:status.${s}`)}
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="h-3 flex-1 overflow-hidden">
                    <motion.span
                      className={cn('block h-full origin-left rounded-r-[4px]', seriesBg[s])}
                      style={{ width: `${(counts[s] / max) * 100}%` }}
                      initial={reduce ? false : { scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ ...transition.large, duration: 0.6 }}
                    />
                  </span>
                  <span className="tabular w-8 text-right text-sm font-medium text-text">
                    {counts[s]}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
