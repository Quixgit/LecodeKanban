import { ArrowUpRight, FolderKanban } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { displayStatus, ProjectGlyph, progressTone, type Project } from '@/features/projects';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ProgressBar,
  ProjectStatusPill,
} from '@/shared/ui';

/** Recently updated projects with progress (dashboard, reference screenshot 3). */
export function RecentProjects({ projects }: { projects: Project[] }) {
  const { t } = useTranslation('dashboard');
  return (
    <Card className="p-5">
      <CardHeader>
        <CardTitle>{t('projects.title')}</CardTitle>
        <Button asChild variant="secondary" size="sm">
          <Link to="/projects">
            {t('projects.all')}
            <ArrowUpRight />
          </Link>
        </Button>
      </CardHeader>
      {projects.length === 0 ? (
        <EmptyState className="py-6" icon={<FolderKanban />} title={t('projects.empty')} />
      ) : (
        <ul className="flex flex-col gap-3">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                to={`/tasks?projectId=${p.id}`}
                className="flex items-center gap-3.5 rounded-xl border border-border-subtle p-3.5 transition-[box-shadow,border-color] duration-ui hover:border-border hover:shadow-sm"
              >
                <ProjectGlyph icon={p.icon} tone={p.tone} />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="truncate text-base font-medium text-text">{p.name}</span>
                    <span className="tabular text-sm font-medium text-text-secondary">
                      {p.progress}%
                    </span>
                  </div>
                  <ProgressBar
                    value={p.progress}
                    tone={progressTone(p)}
                    size="sm"
                    label={`${p.name}: ${p.progress}%`}
                  />
                </div>
                <ProjectStatusPill
                  status={displayStatus(p)}
                  size="sm"
                  className="hidden sm:inline-flex"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
