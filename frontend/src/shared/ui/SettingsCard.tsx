/** A titled block of a settings page. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-xs"
    >
      <header className="border-b border-border-subtle px-6 py-4">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </header>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <footer className="flex items-center justify-end gap-2 border-t border-border-subtle bg-surface-muted/50 px-6 py-3">
          {footer}
        </footer>
      )}
    </section>
  );
}
