import { motion } from 'framer-motion';
import { Activity, ShieldCheck, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { ProductStage } from './ProductStage';

/** The pitch beside the sign-in card: one line of what the product is, the product itself, three proofs. */
export function BrandPanel() {
  const { t } = useTranslation('auth');
  const points = [
    { icon: ShieldCheck, key: 'security' },
    { icon: Activity, key: 'realtime' },
    { icon: Workflow, key: 'integrations' },
  ] as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.large, delay: 0.1 }}
      className="hidden max-w-xl lg:block"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-primary-ink">
        {t('brand.eyebrow')}
      </p>
      <h2 className="text-[2rem] font-semibold leading-[1.15] tracking-tight text-text">
        {t('brand.headline')}
      </h2>
      <p className="mt-3 max-w-md text-md text-text-secondary">{t('brand.tagline')}</p>
      <div className="mt-12">
        <ProductStage />
      </div>
      <ul className="mt-9 grid grid-cols-3 gap-4">
        {points.map(({ icon: Icon, key }) => (
          <li key={key} className="flex flex-col gap-2 border-t border-border pt-3">
            <Icon className="size-4 stroke-[1.75] text-primary-ink" aria-hidden />
            <span className="text-sm font-medium text-text">{t(`brand.points.${key}.title`)}</span>
            <span className="text-xs leading-relaxed text-text-muted">
              {t(`brand.points.${key}.body`)}
            </span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
