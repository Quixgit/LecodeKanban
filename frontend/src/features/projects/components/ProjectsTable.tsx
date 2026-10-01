import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import {
  Avatar,
  IconButton,
  ProgressBar,
  ProjectStatusPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui';
import type { Project } from '../api/projectsApi';
import { ProjectGlyph } from './ProjectGlyph';
import { displayStatus, progressTone } from './status';

export function ProjectsTable({
  projects,
  canEdit,
  onEdit,
}: {
  projects: Project[];
  canEdit: boolean;
  onEdit: (p: Project) => void;
}) {
  const { t } = useTranslation('projects');
  const { language } = useLanguage();
  return (
    <Table>
      <THead>
        <TR>
          <TH>{t('table.project')}</TH>
          <TH className="hidden lg:table-cell">{t('table.pic')}</TH>
          <TH className="hidden xl:table-cell">{t('table.team')}</TH>
          <TH align="right">{t('table.tasks')}</TH>
          <TH className="w-48">{t('table.progress')}</TH>
          <TH className="hidden md:table-cell">{t('table.deadline')}</TH>
          <TH>{t('table.status')}</TH>
          <TH align="center" className="w-16">
            {t('table.action')}
          </TH>
        </TR>
      </THead>
      <TBody>
        {projects.map((p) => (
          <TR key={p.id}>
            <TD>
              <Link
                to={`/tasks?projectId=${p.id}`}
                className="flex items-center gap-3 font-medium text-text hover:text-primary-ink"
              >
                <ProjectGlyph icon={p.icon} tone={p.tone} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  <span className="block font-mono text-2xs text-text-muted">{p.key}</span>
                </span>
              </Link>
            </TD>
            <TD className="hidden lg:table-cell">
              {p.pic ? (
                <span className="flex items-center gap-2 text-text">
                  <Avatar name={p.pic.name} src={p.pic.avatarUrl} size="sm" />
                  <span className="truncate">{p.pic.name}</span>
                </span>
              ) : (
                <span className="text-text-faint">{t('card.noPic')}</span>
              )}
            </TD>
            <TD className="hidden xl:table-cell">{p.team ?? '—'}</TD>
            <TD align="right">
              {p.doneCount} <span className="text-text-faint">/ {p.taskCount}</span>
            </TD>
            <TD>
              <div className="flex items-center gap-3">
                <ProgressBar
                  value={p.progress}
                  tone={progressTone(p)}
                  size="sm"
                  label={`${p.name}: ${p.progress}%`}
                />
                <span className="tabular w-9 text-right text-sm">{p.progress}%</span>
              </div>
            </TD>
            <TD
              className={cn(
                'hidden whitespace-nowrap md:table-cell',
                p.overdue && 'text-danger-ink',
              )}
            >
              {p.deadline ? formatDate(p.deadline, language) : '—'}
            </TD>
            <TD>
              <ProjectStatusPill status={displayStatus(p)} size="sm" />
            </TD>
            <TD align="center">
              {canEdit && (
                <IconButton size="sm" label={t('card.edit')} onClick={() => onEdit(p)}>
                  <Pencil />
                </IconButton>
              )}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
