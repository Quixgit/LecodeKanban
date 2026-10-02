import { Code2, ShieldCheck, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { listContainer, listItem } from '@/shared/motion';
import {
  Avatar,
  Button,
  Card,
  ProgressBar,
  ProjectStatusPill,
  projectStatusTone,
  toneClasses,
} from '@/shared/ui';
import { demoProjects, type DemoProject } from '../model/demoData';
import { ShowcaseSection } from './ShowcaseSection';

const icons = [Target, ShieldCheck, Code2];

function ProjectCard({ project, index }: { project: DemoProject; index: number }) {
  const { t } = useTranslation('showcase');
  const { language } = useLanguage();
  const pct = Math.round((project.done / project.total) * 100);
  const tone = projectStatusTone[project.status];
  const Icon = icons[index % icons.length]!;
  const barTone = project.status === 'pending' ? 'purple' : pct >= 100 ? 'teal' : 'amber';
  const pctInk = toneClasses[barTone].ink;

  return (
    <motion.div variants={listItem}>
      <Card interactive className="flex flex-col p-5">
        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-full text-white',
              toneClasses[tone].fill,
            )}
          >
            <Icon className="size-5 stroke-[1.75]" aria-hidden />
          </span>
          <h3 className="min-w-0 flex-1 truncate text-md font-medium text-text">{project.name}</h3>
          <ProjectStatusPill status={project.status} size="sm" />
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 py-5 text-base">
          <div>
            <dt className="text-sm text-text-muted">{t('projects.pic')}</dt>
            <dd className="mt-2 flex items-center gap-2.5 font-medium text-text">
              <Avatar name={project.pic} size="md" />
              {project.pic}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('projects.teamRole')}</dt>
            <dd className="mt-2 font-medium leading-snug text-text">
              {project.team}
              <br />
              {project.role}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('projects.completedTasks')}</dt>
            <dd className="tabular mt-1.5 font-semibold text-text">
              {project.done} <span className="font-medium text-text-faint">/ {project.total}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-text-muted">{t('projects.deadline')}</dt>
            <dd className="mt-1.5 font-medium text-text">
              {formatDate(project.deadline, language)}
            </dd>
          </div>
        </dl>
        <div className="border-b border-border-subtle pb-5">
          <div className="mb-2.5 flex items-center justify-between text-sm">
            <span className="text-text-muted">{t('projects.progress')}</span>
            <span className={cn('tabular font-medium', pctInk)}>{pct}%</span>
          </div>
          <ProgressBar value={pct} tone={barTone} label={t('projects.progress')} />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button variant="secondary">{t('projects.viewDetails')}</Button>
          <Button variant="outline" disabled={project.status === 'completed'}>
            {t('projects.edit')}
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

export function ProjectCardsSection() {
  const { t } = useTranslation('showcase');
  return (
    <ShowcaseSection id="cards" title={t('projects.title')} description={t('projects.description')}>
      <motion.div
        variants={listContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-40px' }}
        className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3"
      >
        {demoProjects.map((p, i) => (
          <ProjectCard key={p.name} project={p} index={i} />
        ))}
      </motion.div>
    </ShowcaseSection>
  );
}
