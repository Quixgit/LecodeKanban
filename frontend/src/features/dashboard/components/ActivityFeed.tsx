import { motion } from 'framer-motion';
import {
  ArrowRightLeft,
  CircleCheck,
  Eye,
  PlayCircle,
  PlusCircle,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { DashboardStats, TaskStatus } from '@/features/cards';
import { useLanguage } from '@/shared/i18n';
import { formatRelative } from '@/shared/lib/format';
import { listContainer, listItem } from '@/shared/motion';
import { Card, CardHeader, CardTitle, EmptyState } from '@/shared/ui';

type Item = DashboardStats['activity'][number];

const icons: Record<TaskStatus, LucideIcon> = {
  todo: PlusCircle,
  in_progress: PlayCircle,
  in_review: Eye,
  done: CircleCheck,
};

export function ActivityFeed({ items }: { items: Item[] }) {
  const { t } = useTranslation(['dashboard', 'common']);
  const { language } = useLanguage();
  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>{t('activity.title')}</CardTitle>
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState className="py-8" icon={<ArrowRightLeft />} title={t('activity.empty')} />
      ) : (
        <motion.ul
          variants={listContainer}
          initial="hidden"
          animate="visible"
          className="divide-y divide-border-subtle"
        >
          {items.map((a) => {
            const Icon = a.from ? icons[a.to] : PlusCircle;
            const actor = a.actor?.name ?? t('activity.someone');
            const card = `${a.card.key} ${a.card.title}`;
            const text = a.from
              ? t('activity.moved', { actor, card, to: t(`common:status.${a.to}`) })
              : t('activity.created', { actor, card });
            return (
              <motion.li
                key={a.id}
                variants={listItem}
                className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-subtle text-text-secondary">
                  <Icon className="size-[18px] stroke-[1.6]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/tasks?q=${encodeURIComponent(a.card.key)}`}
                    className="line-clamp-2 text-base text-text hover:text-primary-ink"
                  >
                    {text}
                  </Link>
                  <p className="mt-0.5 truncate text-sm text-text-muted">{a.project.name}</p>
                </div>
                <time
                  dateTime={a.at}
                  className="flex shrink-0 items-center gap-1.5 whitespace-nowrap pt-0.5 text-sm text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-primary ring-4 ring-primary-soft"
                  />
                  {formatRelative(a.at, language)}
                </time>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </Card>
  );
}
