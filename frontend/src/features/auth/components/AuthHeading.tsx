import type { ReactNode } from 'react';

export function AuthHeading({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight text-text">{title}</h1>
      {subtitle && <p className="mt-1.5 text-base text-text-secondary">{subtitle}</p>}
    </div>
  );
}
