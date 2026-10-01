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
const barColor: Record<Col, string> = {
  todo: 'bg-white/90',
  progress: 'bg-[#f2cc83]',
  done: 'bg-[#8fdcd5]',
};

/** Mini Kanban board whose cards hop between columns — the product's hero, in miniature. */
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
      <div className="grid grid-cols-3 gap-3 rounded-2xl border border-white/20 bg-white/10 p-3 shadow-[0_30px_60px_-20px_rgb(0_0_0/0.35)] backdrop-blur-md">
        {COLS.map((col) => (
          <div key={col} className="min-h-[188px] rounded-xl bg-white/10 p-2.5">
            <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-white/90">
              <span className={`h-3 w-[3px] rounded-full ${barColor[col]}`} />
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
                    className="rounded-lg bg-white px-2.5 py-2 text-left shadow-sm"
                  >
                    <p className="text-[11px] font-medium leading-tight text-[#1c1c1c]">
                      {t(`brand.cards.${k}`)}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span
                        className={`h-1.5 w-8 rounded-full ${col === 'done' ? 'bg-[#4cb5ae]' : col === 'progress' ? 'bg-[#e6b04b]' : 'bg-[#d8d8d8]'}`}
                      />
                      <span className="size-4 rounded-full bg-[#e9f4f2] ring-2 ring-white" />
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

export function BrandPanel() {
  const { t } = useTranslation('auth');
  const points = [
    { icon: Columns3, key: 'kanban' },
    { icon: CalendarDays, key: 'integrations' },
    { icon: Languages, key: 'languages' },
  ] as const;
  return (
    <div className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#3fa59e_0%,#2f8f88_45%,#22706b_100%)] text-white lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20">
      {/* Drifting light blobs: transform-only animation, disabled for reduced motion. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-[#8fdcd5]/40 blur-3xl motion-safe:animate-[lk-drift_18s_ease-in-out_infinite]" />
        <div className="absolute -bottom-32 right-[-80px] size-[480px] rounded-full bg-[#f2cc83]/25 blur-3xl motion-safe:animate-[lk-drift_22s_ease-in-out_infinite_reverse]" />
        <div className="absolute right-1/3 top-1/3 size-[260px] rounded-full bg-[#b89dda]/25 blur-3xl motion-safe:animate-[lk-drift_26s_ease-in-out_infinite]" />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...transition.large, delay: 0.1 }}
        className="relative z-10 max-w-lg"
      >
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">
          {t('brand.headline')}
        </h2>
        <p className="mt-3 text-md text-white/80">{t('brand.tagline')}</p>
        <div className="mt-9">
          <MiniBoard />
        </div>
        <ul className="mt-9 flex flex-col gap-3">
          {points.map(({ icon: Icon, key }) => (
            <li key={key} className="flex items-center gap-3 text-base text-white/90">
              <span className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                <Icon className="size-4 stroke-[1.75]" aria-hidden />
              </span>
              {t(`brand.points.${key}`)}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
