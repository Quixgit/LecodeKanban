import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import type { StepId } from '../model/steps';

/** The list of steps beside the card: done ones tick, the current one glows, the rest wait. */
export function Rail({
  steps,
  current,
  logo,
}: {
  steps: readonly StepId[];
  current: StepId;
  logo: ReactNode;
}) {
  const { t } = useTranslation('onboarding');
  const reduce = useReducedMotion();
  const at = steps.indexOf(current);
  return (
    <aside className="hidden flex-col justify-between py-10 pl-10 lg:flex">
      <div>
        {logo}
        <p className="mt-12 text-xs font-semibold uppercase tracking-[0.14em] text-text-muted">
          {t('rail.title')}
        </p>
        <ol className="mt-4 flex flex-col">
          {steps.map((s, i) => {
            const done = i < at;
            const active = i === at;
            return (
              <li
                key={s}
                className="relative flex items-center gap-3 py-2.5"
                aria-current={active ? 'step' : undefined}
              >
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[13px] top-[2.1rem] h-5 w-px bg-border"
                  >
                    <motion.span
                      className="block w-full origin-top bg-primary"
                      style={{ height: '100%' }}
                      initial={false}
                      animate={{ scaleY: done ? 1 : 0 }}
                      transition={reduce ? { duration: 0 } : transition.large}
                    />
                  </span>
                )}
                <span
                  className={cn(
                    'relative z-10 grid size-7 place-items-center rounded-full border text-xs font-semibold transition-colors duration-ui',
                    done && 'border-primary bg-primary text-on-primary',
                    active && 'border-primary bg-surface text-primary-ink ring-4 ring-primary/15',
                    !done && !active && 'border-border bg-surface text-text-muted',
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-sm transition-colors',
                    active
                      ? 'font-semibold text-text'
                      : done
                        ? 'text-text-secondary'
                        : 'text-text-muted',
                  )}
                >
                  {t(`rail.${s}`)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
