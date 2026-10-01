import { motion } from 'framer-motion';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { listItem } from '@/shared/motion';
import { Avatar, Button, Card, ProgressBar, ProjectStatusPill, toneClasses } from '@/shared/ui';
import type { Project } from '../api/projectsApi';
import { ProjectGlyph } from './ProjectGlyph';
import { displayStatus, progressTone } from './status';

interface Props {
  project: Project;
  canEdit: boolean;
  onEdit: (p: Project) => void;
}

/** Project tile matching the reference design (PIC, team/role, tasks, deadline, progress). */
export const ProjectCard = memo(function ProjectCard({ project: p, canEdit, onEdit }: Props) {
  const { t } = useTranslation(['projects', 'team']);
  const { language } = useLanguage();
  const tone = progressTone(p);

  return (
    <motion.div variants={listItem} layout="position">
      <Card interactive className="flex h-full flex-col p-5">
        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
          <ProjectGlyph icon={p.icon} tone={p.tone} />
          <h3 className="min-w-0 flex-1 truncate text-md font-medium text-text" title={p.name}>
            {p.name}
          </h3>
          <ProjectStatusPill status={displayStatus(p)} size="sm" />
        </div>

        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-5 py-5 text-base">
          <div className="min-w-0">
            <dt className="text-sm text-text-muted">{t('card.pic')}</dt>
            <dd className="mt-2 flex items-center gap-2.5 font-medium text-text">
              {p.pic ? (
                <>
                  <Avatar name={p.pic.name} src={p.pic.avatarUrl} size="md" />
                  <span className="truncate">{p.pic.name}</span>
                </>
              ) : (
                <span className="text-text-faint">{t('card.noPic')}</span>
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-sm text-text-muted">{t('card.teamRole')}</dt>
            <dd className="mt-2 font-medium leading-snug text-text">
              <span className="block truncate">{p.team ?? t('card.noTeam')}</span>
              <span className="block truncate">
                {p.picRole ? t(`team:roles.${p.picRole}`) : '—'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('card.completedTasks')}</dt>
            <dd className="tabular mt-1.5 font-semibold text-text">
              {p.doneCount} <span className="font-medium text-text-faint">/ {p.taskCount}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('card.deadline')}</dt>
            <dd className={cn('mt-1.5 font-medium', p.overdue ? 'text-danger-ink' : 'text-text')}>
              {p.deadline ? formatDate(p.deadline, language) : t('card.noDeadline')}
            </dd>
          </div>
        </dl>

        <div className="border-b border-border-subtle pb-5">
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span className="text-text-muted">{t('card.progress')}</span>
            <span className={cn('tabular font-medium', toneClasses[tone].ink)}>{p.progress}%</span>
          </div>
          <ProgressBar value={p.progress} tone={tone} label={`${p.name}: ${p.progress}%`} />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button asChild variant="secondary">
            <Link to={`/tasks?projectId=${p.id}`}>{t('card.viewDetails')}</Link>
          </Button>
          <Button variant="outline" disabled={!canEdit} onClick={() => onEdit(p)}>
            {t('card.edit')}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
});
