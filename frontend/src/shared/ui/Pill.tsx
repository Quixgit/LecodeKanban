import { Check, Flag, Loader, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import {
  priorityTone,
  projectStatusTone,
  statusTone,
  toneClasses,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
  type Tone,
} from './tones';

export interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  icon?: ReactNode;
  size?: 'sm' | 'md';
}

/** Fully rounded soft-tinted label (priority, status, employment type…). */
export function Pill({
  tone = 'neutral',
  icon,
  size = 'md',
  className,
  children,
  ...props
}: PillProps) {
  const t = toneClasses[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium',
        size === 'md' ? 'h-7 px-3 text-sm' : 'h-6 px-2.5 text-xs',
        t.soft,
        t.ink,
        '[&_svg]:size-3.5 [&_svg]:stroke-2',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}

export function PriorityPill({
  priority,
  ...props
}: { priority: Priority } & Omit<PillProps, 'tone'>) {
  const { t } = useTranslation();
  return (
    <Pill tone={priorityTone[priority]} {...props}>
      {t(`priority.${priority}`)}
    </Pill>
  );
}

export function TaskStatusPill({
  status,
  ...props
}: { status: TaskStatus } & Omit<PillProps, 'tone'>) {
  const { t } = useTranslation();
  return (
    <Pill tone={statusTone[status]} {...props}>
      {t(`status.${status}`)}
    </Pill>
  );
}

const projectIcons: Record<ProjectStatus, LucideIcon> = {
  in_progress: Loader,
  completed: Check,
  pending: Flag,
  overdue: TriangleAlert,
};

/** Project status chip with leading icon, as on the Projects cards. */
export function ProjectStatusPill({
  status,
  ...props
}: { status: ProjectStatus } & Omit<PillProps, 'tone' | 'icon'>) {
  const { t } = useTranslation();
  const Icon = projectIcons[status];
  return (
    <Pill tone={projectStatusTone[status]} icon={<Icon aria-hidden />} {...props}>
      {t(`projectStatus.${status}`)}
    </Pill>
  );
}
