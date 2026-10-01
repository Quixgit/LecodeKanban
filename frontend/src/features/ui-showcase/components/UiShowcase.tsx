import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { listContainer } from '@/shared/motion';
import { ControlsSection } from './ControlsSection';
import { DataDisplaySection } from './DataDisplaySection';
import { FoundationsSection } from './FoundationsSection';
import { OverlaysSection } from './OverlaysSection';
import { ProjectCardsSection } from './ProjectCardsSection';
import { TableSection } from './TableSection';

const sections = ['foundations', 'controls', 'data', 'table', 'cards', 'overlays'] as const;

/** Living style guide for shared/ui — every primitive in every state. */
export function UiShowcase() {
  const { t } = useTranslation('showcase');
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label={t('toc')} className="flex flex-wrap gap-2">
        {sections.map((s) => (
          <a
            key={s}
            href={`#${s}`}
            className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm text-text-secondary shadow-xs transition-colors hover:border-primary-border hover:text-primary-ink"
          >
            {t(`${s === 'cards' ? 'projects' : s}.title`)}
          </a>
        ))}
      </nav>
      <motion.div
        variants={listContainer}
        initial="hidden"
        animate="visible"
        className="flex flex-col gap-6"
      >
        <FoundationsSection />
        <ControlsSection />
        <DataDisplaySection />
        <TableSection />
        <ProjectCardsSection />
        <OverlaysSection />
      </motion.div>
    </div>
  );
}
