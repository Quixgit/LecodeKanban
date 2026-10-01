import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { fadeUp } from '@/shared/motion';
import { Card } from '@/shared/ui';

export function ShowcaseSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <motion.section
      id={id}
      variants={fadeUp}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24"
    >
      <Card className="p-6">
        <header className="mb-5">
          <h2 id={`${id}-title`} className="text-lg font-semibold text-text">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-base text-text-muted">{description}</p>}
        </header>
        {children}
      </Card>
    </motion.section>
  );
}

export function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
      )}
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
