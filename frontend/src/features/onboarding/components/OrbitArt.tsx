import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, Clock, FileText, KanbanSquare, MessagesSquare, Users } from 'lucide-react';
import { transition } from '@/shared/motion';

const ORBIT = [
  { icon: KanbanSquare, tone: 'bg-series-todo' },
  { icon: Clock, tone: 'bg-series-progress' },
  { icon: MessagesSquare, tone: 'bg-series-review' },
  { icon: FileText, tone: 'bg-series-done' },
  { icon: CalendarDays, tone: 'bg-series-todo' },
  { icon: Users, tone: 'bg-series-progress' },
] as const;

/** The welcome picture: the logo tile in the middle and the parts of the product circling it. */
export function OrbitArt({ size = 220 }: { size?: number }) {
  const reduce = useReducedMotion();
  const radius = size / 2 - 22;
  return (
    <div aria-hidden className="relative mx-auto" style={{ width: size, height: size }}>
      <span className="absolute inset-4 rounded-full border border-dashed border-border" />
      <span className="absolute inset-[34px] rounded-full border border-border-subtle" />
      <motion.span
        className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl bg-primary-solid text-on-primary shadow-primary"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={transition.spring}
      >
        <KanbanSquare className="size-8 stroke-[1.6]" />
      </motion.span>
      <motion.div
        className="absolute inset-0"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 36, repeat: Infinity, ease: 'linear' }}
      >
        {ORBIT.map(({ icon: Icon, tone }, i) => {
          const angle = (i / ORBIT.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <motion.span
              key={i}
              className={`absolute grid size-9 place-items-center rounded-xl text-white shadow-md ${tone}`}
              style={{
                left: size / 2 + Math.cos(angle) * radius - 18,
                top: size / 2 + Math.sin(angle) * radius - 18,
              }}
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={reduce ? undefined : { scale: 1, opacity: 1, rotate: -360 }}
              transition={{
                scale: { ...transition.spring, delay: 0.25 + i * 0.07 },
                opacity: { delay: 0.25 + i * 0.07 },
                rotate: { duration: 36, repeat: Infinity, ease: 'linear' },
              }}
            >
              <Icon className="size-4" />
            </motion.span>
          );
        })}
      </motion.div>
    </div>
  );
}
