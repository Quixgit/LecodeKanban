import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Columns3, Languages } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';

type Col = 'todo' | 'progress' | 'done';
const COLS: Col[] = ['todo', 'progress', 'done'];
const CYCLE: Record<string, Col>[] = [
  { a: 'todo', b: 'todo', c: 'progress' },
  { a: 'progress', b: 'todo', c: 'done' },
  { a: 'progress', b: 'progress', c: 'done' },
  { a: 'done', b: 'progress', c: 'done' },
];
const dot: Record<Col, string> = { todo: 'bg-todo', progress: 'bg-progress', done: 'bg-done' };
const bar: Record<Col, string> = {
  todo: 'bg-border-strong',
  progress: 'bg-progress-bar',
  done: 'bg-done',
};

/** Mini Kanban board whose cards hop between columns: the real board's look, in miniature. */
function MiniBoard() {
  const { t } = useTranslation('auth');
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % CYCLE.length), 2600);
    return () => window.clearInterval(id);
  }, [reduce]);
  const placement = CYCLE[step]!;

  return (
    <LayoutGroup>
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-border bg-surface/70 p-3 shadow-lg backdrop-blur-sm">
        {COLS.map((col) => (
          <div key={col} className="min-h-[196px] rounded-xl bg-surface-column p-2.5">
            <p className="mb-2.5 flex items-center gap-2 text-xs font-medium text-text-secondary">
              <span className={`size-2 rounded-full ${dot[col]}`} aria-hidden />
              {t(`brand.columns.${col}`)}
            </p>
            <div className="flex flex-col gap-2">
              {(['a', 'b', 'c'] as const)
                .filter((k) => placement[k] === col)
                .map((k) => (
                  <motion.div
                    key={k}
                    layoutId={`mini-${k}`}
                    transition={transition.softSpring}
                    className="rounded-lg border border-border-subtle bg-surface px-2.5 py-2 text-left shadow-sm"
                  >
                    <p className="text-xs font-medium leading-tight text-text">
                      {t(`brand.cards.${k}`)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`h-1.5 w-8 rounded-full ${bar[col]}`} />
                      <span className="size-4 rounded-full bg-primary-soft ring-2 ring-surface" />
                    </div>
                  </motion.div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </LayoutGroup>
  );
}

/** Product pitch that sits on the shared page background, next to the sign-in card. */
export function BrandPanel() {
  const { t } = useTranslation('auth');
  const points = [
    { icon: Columns3, key: 'kanban' },
    { icon: CalendarDays, key: 'integrations' },
    { icon: Languages, key: 'languages' },
  ] as const;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transition.large, delay: 0.1 }}
      className="hidden max-w-lg lg:block"
    >
      <h2 className="text-3xl font-semibold leading-tight tracking-tight text-text">
        {t('brand.headline')}
      </h2>
      <p className="mt-3 text-md text-text-secondary">{t('brand.tagline')}</p>
      <div className="mt-8">
        <MiniBoard />
      </div>
      <ul className="mt-8 flex flex-col gap-3">
        {points.map(({ icon: Icon, key }) => (
          <li key={key} className="flex items-center gap-3 text-base text-text-secondary">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary-soft text-primary-ink">
              <Icon className="size-4 stroke-[1.75]" aria-hidden />
            </span>
            {t(`brand.points.${key}`)}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

/** One quiet backdrop for the whole page: board lanes fading out, with soft brand-coloured light. */
export function AuthBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-40 size-[560px] rounded-full bg-primary/20 blur-3xl motion-safe:animate-[lk-drift_22s_ease-in-out_infinite]" />
      <div className="absolute -bottom-48 -right-24 size-[560px] rounded-full bg-progress-bar/25 blur-3xl motion-safe:animate-[lk-drift_26s_ease-in-out_infinite_reverse]" />
      <div className="absolute right-[28%] top-[8%] size-[320px] rounded-full bg-review-bar/20 blur-3xl motion-safe:animate-[lk-drift_30s_ease-in-out_infinite]" />
      <div className="absolute inset-x-[4%] inset-y-0 hidden grid-cols-4 gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_22%,black_78%,transparent)] lg:grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-3xl bg-surface-column/60" />
        ))}
      </div>
    </div>
  );
}
