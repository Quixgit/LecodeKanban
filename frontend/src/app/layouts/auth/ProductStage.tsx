import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Bell, GitPullRequest, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { CountUp } from '@/shared/ui';

type Col = 'todo' | 'progress' | 'review' | 'done';
const COLS: Col[] = ['todo', 'progress', 'review', 'done'];
/** Where each of the four cards sits at every step: they move through the workflow one after another. */
const STEPS: Record<string, Col>[] = [
  { a: 'todo', b: 'progress', c: 'review', d: 'done' },
  { a: 'progress', b: 'progress', c: 'done', d: 'done' },
  { a: 'progress', b: 'review', c: 'done', d: 'done' },
  { a: 'review', b: 'review', c: 'done', d: 'done' },
  { a: 'done', b: 'done', c: 'done', d: 'done' },
  { a: 'todo', b: 'todo', c: 'progress', d: 'review' },
];
const TICK_MS = 2800;

const dot: Record<Col, string> = {
  todo: 'bg-series-todo',
  progress: 'bg-series-progress',
  review: 'bg-series-review',
  done: 'bg-series-done',
};

/** A line that draws itself, then redraws: the shape of a team's week. */
function Spark({ points, className }: { points: number[]; className?: string }) {
  const reduce = useReducedMotion();
  const w = 120;
  const h = 36;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const xy = points.map(
    (p, i) =>
      [(i / (points.length - 1)) * w, h - 3 - ((p - min) / (max - min || 1)) * (h - 8)] as const,
  );
  const line = xy
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden preserveAspectRatio="none">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--c-series-done))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(var(--c-series-done))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#spark-fill)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.5 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="rgb(var(--c-series-done))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: 'easeOut' }}
      />
    </svg>
  );
}

function Cursor({
  name,
  tone,
  path,
  delay,
}: {
  name: string;
  tone: string;
  path: { x: number[]; y: number[] };
  delay: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 z-30"
      initial={false}
      animate={reduce ? { x: path.x[0], y: path.y[0] } : { x: path.x, y: path.y }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" className="drop-shadow-sm">
        <path
          d="M2 1.5 16 8.2l-6.1 1.6L7.6 16z"
          className={tone}
          stroke="rgb(var(--c-surface))"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      <span className="-mt-1 ml-3.5 inline-block rounded-md bg-text px-1.5 py-0.5 text-[10px] font-medium leading-none text-surface shadow-sm">
        {name}
      </span>
    </motion.div>
  );
}

/**
 * A miniature of the real product, composed the way a screenshot would be: sprint header with who is online,
 * three numbers, the board with cards moving through the workflow, and a feed of what just happened.
 * Everything on it moves because of the data, not for decoration; with reduced motion it stands still.
 */
export function ProductStage() {
  const { t } = useTranslation('auth');
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), TICK_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  const placement = STEPS[step]!;
  const feed = t('brand.stage.feed', { returnObjects: true }) as { who: string; what: string }[];
  const event = feed[step % feed.length]!;

  const onMove = (e: React.PointerEvent) => {
    if (reduce || !frame.current) return;
    const r = frame.current.getBoundingClientRect();
    setTilt({
      x: ((e.clientX - r.left) / r.width - 0.5) * 2,
      y: ((e.clientY - r.top) / r.height - 0.5) * 2,
    });
  };

  return (
    <div
      ref={frame}
      className="relative mx-auto w-full max-w-[600px] [perspective:1400px]"
      onPointerMove={onMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      aria-hidden
    >
      <motion.div
        className="relative rounded-2xl border border-border bg-surface/85 shadow-xl backdrop-blur-md"
        initial={reduce ? false : { opacity: 0, y: 28, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: -tilt.y * 3, rotateY: tilt.x * 4 }}
        transition={{ ...transition.softSpring, opacity: { duration: 0.6 } }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Header: where we are and who is here. */}
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-[11px] font-semibold text-primary-ink">
              PU
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-text">{t('brand.stage.project')}</p>
              <p className="text-[11px] text-text-muted">{t('brand.stage.sprint')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-done-soft px-2 py-0.5 text-[11px] font-medium text-done-ink">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-done opacity-70 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-done" />
              </span>
              {t('brand.stage.live')}
            </span>
            <div className="flex -space-x-1.5">
              {[
                ['MA', 'bg-primary-soft text-primary-ink'],
                ['OK', 'bg-review-soft text-review-ink'],
                ['PT', 'bg-progress-soft text-progress-ink'],
              ].map(([n, c]) => (
                <span
                  key={n}
                  className={`grid size-6 place-items-center rounded-full text-[9px] font-semibold ring-2 ring-surface ${c}`}
                >
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Three numbers. */}
        <div className="grid grid-cols-3 gap-3 px-4 pt-4">
          <div className="rounded-xl border border-border-subtle bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">
              {t('brand.stage.kpi.throughput')}
            </p>
            <p className="tabular text-xl font-semibold leading-tight text-text">
              <CountUp value={42} />
              <span className="ml-1 text-[11px] font-medium text-done-ink">+12%</span>
            </p>
            <Spark points={[3, 5, 4, 7, 6, 9, 8, 12]} className="mt-1 h-7 w-full" />
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">{t('brand.stage.kpi.cycle')}</p>
            <p className="tabular text-xl font-semibold leading-tight text-text">
              <CountUp value={2.3} format={(n) => n.toFixed(1)} />
              <span className="ml-1 text-[11px] font-medium text-text-muted">
                {t('brand.stage.days')}
              </span>
            </p>
            <div className="mt-2 flex h-9 items-end gap-1.5 border-b border-border-subtle">
              {[48, 70, 56, 86, 64, 44, 34].map((v, i) => (
                <motion.span
                  key={i}
                  className="w-full origin-bottom rounded-t-[3px] bg-series-progress/75"
                  style={{ height: `${v}%` }}
                  initial={reduce ? false : { scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ ...transition.large, delay: 0.5 + i * 0.05 }}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border-subtle bg-surface p-3">
            <p className="text-[11px] font-medium text-text-muted">{t('brand.stage.kpi.ontime')}</p>
            <p className="tabular text-xl font-semibold leading-tight text-text">
              <CountUp value={96} />
              <span className="text-[11px] font-medium text-text-muted">%</span>
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <motion.div
                className="h-full origin-left rounded-full bg-series-done"
                style={{ width: '96%' }}
                initial={reduce ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ ...transition.large, duration: 1.1, delay: 0.6 }}
              />
            </div>
            <p className="mt-2 text-[10px] text-text-muted">{t('brand.stage.kpi.ontimeHint')}</p>
          </div>
        </div>

        {/* The board. */}
        <LayoutGroup>
          <div className="grid grid-cols-4 gap-2.5 p-4">
            {COLS.map((col) => (
              <div key={col} className="min-h-[148px] rounded-xl bg-surface-column p-2">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
                  <span className={`size-1.5 rounded-full ${dot[col]}`} />
                  {t(`brand.stage.columns.${col}`)}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(['a', 'b', 'c', 'd'] as const)
                    .filter((k) => placement[k] === col)
                    .map((k) => (
                      <motion.div
                        key={k}
                        layoutId={`stage-${k}`}
                        transition={transition.softSpring}
                        className="rounded-lg border border-border-subtle bg-surface px-2 py-1.5 shadow-xs"
                      >
                        <p className="text-[10.5px] font-medium leading-tight text-text">
                          {t(`brand.stage.cards.${k}.title`)}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[9px] font-medium text-text-muted">
                            {t(`brand.stage.cards.${k}.key`)}
                          </span>
                          <span
                            className={`size-3.5 rounded-full ring-2 ring-surface ${k === 'a' ? 'bg-primary-soft' : k === 'b' ? 'bg-review-soft' : k === 'c' ? 'bg-progress-soft' : 'bg-done-soft'}`}
                          />
                        </div>
                      </motion.div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </LayoutGroup>

        {/* What just happened. */}
        <div className="flex items-center gap-2.5 border-t border-border-subtle px-4 py-2.5">
          <GitPullRequest className="size-3.5 shrink-0 text-text-muted" aria-hidden />
          <div className="relative h-4 flex-1 overflow-hidden text-[11px] text-text-secondary">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={step % feed.length}
                className="absolute inset-0 truncate"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={transition.ui}
              >
                <span className="font-medium text-text">{event.who}</span> {event.what}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>

        {/* Collaborators moving about the board. */}
        <Cursor
          name="Maria"
          tone="fill-series-todo"
          delay={0}
          path={{ x: [60, 250, 400, 180, 60], y: [190, 150, 230, 270, 190] }}
        />
        <Cursor
          name="Oleh"
          tone="fill-series-review"
          delay={3}
          path={{ x: [440, 300, 120, 340, 440], y: [250, 200, 240, 160, 250] }}
        />
      </motion.div>

      {/* Things that float above the window. */}
      <motion.div
        className="absolute -top-8 right-6 z-20 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-lg"
        initial={reduce ? false : { opacity: 0, x: 24, y: -8 }}
        animate={{ opacity: 1, x: 0, y: reduce ? 0 : [0, -5, 0] }}
        transition={{
          opacity: { duration: 0.6, delay: 1.2 },
          x: { ...transition.softSpring, delay: 1.2 },
          y: { duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 },
        }}
      >
        <span className="grid size-7 place-items-center rounded-lg bg-review-soft text-review-ink">
          <Bell className="size-3.5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold text-text">
            {t('brand.stage.toast.title')}
          </span>
          <span className="block text-[10px] text-text-muted">{t('brand.stage.toast.body')}</span>
        </span>
      </motion.div>
      <motion.div
        className="absolute -bottom-4 -left-5 z-20 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 shadow-lg"
        initial={reduce ? false : { opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0, y: reduce ? 0 : [0, 5, 0] }}
        transition={{
          opacity: { duration: 0.6, delay: 1.5 },
          x: { ...transition.softSpring, delay: 1.5 },
          y: { duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 2.4 },
        }}
      >
        <span className="grid size-7 place-items-center rounded-lg bg-done-soft text-done-ink">
          <ShieldCheck className="size-3.5" />
        </span>
        <span className="leading-tight">
          <span className="block text-[11px] font-semibold text-text">
            {t('brand.stage.secure.title')}
          </span>
          <span className="block text-[10px] text-text-muted">{t('brand.stage.secure.body')}</span>
        </span>
      </motion.div>
    </div>
  );
}
