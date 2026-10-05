import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, PartyPopper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { Card, CardHeader, CardTitle } from '@/shared/ui';
import { useOnboardingStore } from '@/features/onboarding';
import { useQuickStart } from '../hooks/useQuickStart';
import { useQuickStartMarks } from '../model/quickStartStore';

const R = 18;
const C = 2 * Math.PI * R;

/** A progress ring that fills as steps are done. */
function Ring({ done, total }: { done: number; total: number }) {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 44 44" className="size-12 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" className="stroke-surface-sunken" />
      <motion.circle
        cx="22"
        cy="22"
        r={R}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-done"
        strokeDasharray={C}
        initial={reduce ? false : { strokeDashoffset: C }}
        animate={{ strokeDashoffset: C * (1 - done / total) }}
        transition={{ ...transition.large, duration: 0.7 }}
      />
    </svg>
  );
}

/** The new-member checklist. Steps the platform can see tick themselves; the rest can be ticked by hand. */
export function QuickStartCard() {
  const { t } = useTranslation(['help', 'onboarding']);
  const reduce = useReducedMotion();
  const steps = useQuickStart();
  const toggle = useQuickStartMarks((s) => s.toggle);
  const openWizard = useOnboardingStore((s) => s.open);
  const done = steps.filter((s) => s.done).length;

  return (
    <Card className="p-5">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Ring done={done} total={steps.length} />
          <div>
            <CardTitle>{t('quickStart.title')}</CardTitle>
            <p className="text-sm text-text-muted" role="status">
              {done === steps.length
                ? t('quickStart.allDone')
                : t('quickStart.progress', { done, total: steps.length })}
            </p>
          </div>
        </div>
        {done === steps.length && <PartyPopper className="size-6 text-done" aria-hidden />}
      </CardHeader>
      <ol className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <motion.li
            key={s.id}
            initial={reduce ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...transition.ui, delay: i * 0.05 }}
            className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted"
          >
            {s.auto ? (
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border transition-colors',
                  s.done ? 'border-done bg-done text-white' : 'border-border text-transparent',
                )}
              >
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
                <span className="sr-only">
                  {s.done ? t('quickStart.done') : t('quickStart.todo')}
                </span>
              </span>
            ) : (
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                aria-label={s.done ? t('quickStart.unmark') : t('quickStart.markDone')}
                onClick={() => toggle(s.id)}
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  s.done
                    ? 'border-done bg-done text-white'
                    : 'border-border text-transparent hover:border-done',
                )}
              >
                <Check className="size-3.5" strokeWidth={3} />
              </button>
            )}
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-sm font-medium',
                  s.done ? 'text-text-muted line-through' : 'text-text',
                )}
              >
                {t(`quickStart.steps.${s.id}.title`)}
              </span>
              <span className="block text-xs text-text-muted">
                {t(`quickStart.steps.${s.id}.description`)}
              </span>
            </span>
            <Link
              to={s.to}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-primary-ink hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {t('quickStart.go')}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </motion.li>
        ))}
      </ol>
      <button
        type="button"
        onClick={openWizard}
        className="mt-3 rounded-md px-2 py-1 text-sm text-primary-ink hover:bg-primary-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {t('onboarding:help.again')}
      </button>
    </Card>
  );
}
