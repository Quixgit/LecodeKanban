import { cn } from '@/shared/lib/cn';
import { toneClasses } from '@/shared/ui';
import type { ProjectIcon, Tone } from '../api/projectsApi';
import { projectIcons } from './icons';

const sizes = { sm: 'size-7 [&_svg]:size-3.5', md: 'size-10 [&_svg]:size-5' } as const;

/** Round tone-filled badge with the project icon (as on the Projects cards). */
export function ProjectGlyph({
  icon,
  tone,
  size = 'md',
  className,
}: {
  icon: ProjectIcon;
  tone: Tone;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const Icon = projectIcons[icon];
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full text-white shadow-glyph [&_svg]:stroke-[1.9]',
        toneClasses[tone].fill,
        sizes[size],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
