import type { ReactNode } from 'react';

export function TooltipBox({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
      <p className="mb-2 font-medium text-text">{title}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

export function TooltipRow({
  swatch,
  label,
  value,
}: {
  swatch: string;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className={`size-2.5 rounded-sm ${swatch}`} />
      <span className="flex-1 text-text-secondary">{label}</span>
      <span className="tabular font-medium text-text">{value}</span>
    </li>
  );
}

export function Legend({
  items,
  label,
}: {
  items: { swatch: string; label: ReactNode }[];
  label: string;
}) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5" aria-label={label}>
      {items.map((i, n) => (
        <li key={n} className="flex items-center gap-1.5 text-sm text-text-secondary">
          <span aria-hidden className={`size-2.5 rounded-sm ${i.swatch}`} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
