import { animate, useInView, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { ease } from '../motion/presets';

export interface CountUpProps {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}

/** Counts from 0 to `value` the first time it scrolls into view. */
export function CountUp({
  value,
  format = (n) => Math.round(n).toString(),
  duration = 0.9,
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(0, value, { duration, ease, onUpdate: setDisplay });
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format(display)}
    </span>
  );
}
