import type { ReactNode } from 'react';

/** Title and one-line explanation at the top of a settings page. */
export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        <p className="mt-0.5 max-w-xl text-sm text-text-muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
