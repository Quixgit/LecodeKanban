import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/cn';
import { transition } from '@/shared/motion';
import { passwordScore } from '../model/schemas';

const levels = ['weak', 'weak', 'fair', 'good', 'strong'] as const;
const colors = ['bg-danger', 'bg-danger', 'bg-progress', 'bg-primary', 'bg-done'];

export function StrengthMeter({ password }: { password: string }) {
  const { t } = useTranslation('auth');
  const score = passwordScore(password);
  if (!password) return null;
  const level = t(`password.strength.${levels[score]}`);
  return (
    <div className="mt-2 flex items-center gap-3" aria-live="polite">
      <div className="flex flex-1 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-surface-sunken">
            <motion.div
              className={cn('h-full origin-left', colors[score])}
              initial={false}
              animate={{ scaleX: i <= Math.max(score, 1) ? 1 : 0 }}
              transition={transition.ui}
            />
          </div>
        ))}
      </div>
      <span className="text-xs text-text-muted">{t('password.strength.label', { level })}</span>
    </div>
  );
}
