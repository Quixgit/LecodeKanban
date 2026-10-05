import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StepIcon } from './StepIcon';

/** Icon, title and one sentence: the top of every step. The title takes focus when a step opens. */
export function StepHead({
  icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <header className="mb-6">
      <StepIcon icon={icon} />
      <h2
        data-step-title
        tabIndex={-1}
        className="text-2xl font-semibold tracking-tight text-text outline-none"
      >
        {title}
      </h2>
      {subtitle && <p className="mt-1.5 max-w-md text-base text-text-secondary">{subtitle}</p>}
    </header>
  );
}
