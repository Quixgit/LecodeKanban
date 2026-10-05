import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import type { Mode } from '../../model/steps';
import { OrbitArt } from '../OrbitArt';

export function WelcomeStep({
  mode,
  name,
  workspace,
}: {
  mode: Mode;
  name: string;
  workspace: string;
}) {
  const { t } = useTranslation('onboarding');
  const reduce = useReducedMotion();
  const first = name.trim().split(/\s+/)[0] ?? '';
  const points =
    mode === 'create'
      ? (['workspace', 'about', 'photo', 'team'] as const)
      : (['about', 'photo', 'contacts'] as const);
  const key = (p: string) =>
    mode === 'create' ? `welcome.points.${p}` : `welcome.pointsJoin.${p}`;
  return (
    <div className="text-center sm:text-left">
      <OrbitArt />
      <h2
        data-step-title
        tabIndex={-1}
        className="mt-6 text-3xl font-semibold tracking-tight text-text outline-none"
      >
        {mode === 'create'
          ? t('welcome.createTitle', { name: first })
          : t('welcome.joinTitle', { name: first, workspace })}
      </h2>
      <p className="mt-2 max-w-md text-base text-text-secondary">
        {mode === 'create' ? t('welcome.createSubtitle') : t('welcome.joinSubtitle')}
      </p>
      <ul className="mt-6 flex flex-col gap-2.5">
        {points.map((p, i) => (
          <motion.li
            key={p}
            className="flex items-center gap-3 text-base text-text"
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transition.large, delay: 0.35 + i * 0.09 }}
          >
            <span className="grid size-6 place-items-center rounded-full bg-done-soft text-done-ink">
              <Check className="size-3.5" strokeWidth={3} aria-hidden />
            </span>
            {t(key(p))}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
