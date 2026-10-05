import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Avatar } from '@/shared/ui';
import { transition } from '@/shared/motion';
import type { Mode } from '../../model/steps';
import { Confetti } from '../Confetti';

/** The finish: a check that draws itself, a burst of confetti and a card with what was set up. */
export function DoneStep({
  mode,
  workspace,
  name,
  jobTitle,
  avatarUrl,
}: {
  mode: Mode;
  workspace: string;
  name: string;
  jobTitle: string;
  avatarUrl: string | null;
}) {
  const { t } = useTranslation('onboarding');
  const reduce = useReducedMotion();
  return (
    <div className="relative text-center">
      <Confetti />
      <motion.div
        aria-hidden
        className="mx-auto mb-6 grid size-20 place-items-center rounded-full bg-done-soft"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={transition.spring}
      >
        <svg viewBox="0 0 52 52" className="size-11">
          <motion.path
            d="M14 27 l8 8 l16 -18"
            fill="none"
            stroke="rgb(var(--c-series-done))"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduce ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, delay: 0.25, ease: 'easeOut' }}
          />
        </svg>
      </motion.div>
      <h2
        data-step-title
        tabIndex={-1}
        className="text-3xl font-semibold tracking-tight text-text outline-none"
      >
        {t('done.title')}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-base text-text-secondary">
        {mode === 'create'
          ? t('done.subtitleCreate', { workspace })
          : t('done.subtitleJoin', { workspace })}
      </p>
      <motion.div
        className="mx-auto mt-7 flex max-w-xs items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition.large, delay: 0.5 }}
      >
        <Avatar name={name || '?'} src={avatarUrl} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{name}</p>
          <p className="truncate text-xs text-text-muted">
            {[jobTitle, workspace].filter(Boolean).join(' · ')}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
