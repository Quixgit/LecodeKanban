/**
 * The page behind the sign-in card: a fine engineering grid that fades out toward the edges, two slow pools of
 * brand light, a little film grain and a few lines of light running down the grid. Nothing here is a picture:
 * it is all gradients, so it stays sharp at any size and follows the light and dark themes through the tokens.
 */

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>\")";

/** Columns (in % of the width) where a line of light travels, with its own pace and start. */
const STREAMS = [
  { left: '9%', delay: '0s', duration: '9s' },
  { left: '23%', delay: '3.2s', duration: '11s' },
  { left: '41%', delay: '6.1s', duration: '10s' },
  { left: '58%', delay: '1.4s', duration: '12s' },
  { left: '76%', delay: '4.7s', duration: '9.5s' },
  { left: '91%', delay: '7.9s', duration: '11.5s' },
] as const;

export function GridBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-bg">
      {/* Pools of light, drifting slowly. */}
      <div
        className="absolute -left-[12%] -top-[30%] h-[80%] w-[60%] motion-safe:animate-[lk-drift_26s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(closest-side, rgb(var(--c-primary) / 0.20), transparent)',
        }}
      />
      <div
        className="absolute -bottom-[35%] right-[-10%] h-[85%] w-[62%] motion-safe:animate-[lk-drift_32s_ease-in-out_infinite_reverse]"
        style={{
          background: 'radial-gradient(closest-side, rgb(var(--c-review-bar) / 0.18), transparent)',
        }}
      />
      <div
        className="absolute right-[18%] top-[-12%] h-[48%] w-[34%] motion-safe:animate-[lk-drift_38s_ease-in-out_infinite]"
        style={{
          background:
            'radial-gradient(closest-side, rgb(var(--c-progress-bar) / 0.14), transparent)',
        }}
      />

      {/* The engineering grid: fine lines every 56px, brightest around the middle. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(var(--c-border-strong) / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-border-strong) / 0.7) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          backgroundPosition: 'center top',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 42%, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 70% at 50% 42%, black 20%, transparent 75%)',
        }}
      />
      {/* A coarser grid on top gives the field some depth. */}
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(var(--c-border-strong) / 0.9) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-border-strong) / 0.9) 1px, transparent 1px)',
          backgroundSize: '224px 224px',
          backgroundPosition: 'center top',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black 10%, transparent 70%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at 50% 40%, black 10%, transparent 70%)',
        }}
      />

      {/* Lines of light running down the grid. */}
      <div className="absolute inset-0 hidden motion-safe:block">
        {STREAMS.map((s) => (
          <span
            key={s.left}
            className="absolute top-0 h-40 w-px"
            style={{
              left: s.left,
              background:
                'linear-gradient(to bottom, transparent, rgb(var(--c-primary) / 0.7), transparent)',
              animation: `lk-stream ${s.duration} cubic-bezier(0.4, 0, 0.2, 1) ${s.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Film grain, so the gradients never band. */}
      <div
        className="absolute inset-0 opacity-[0.045] mix-blend-multiply dark:opacity-[0.08] dark:mix-blend-screen"
        style={{ backgroundImage: GRAIN }}
      />
      {/* A soft vignette keeps the eye in the middle. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 120% 100% at 50% 40%, transparent 55%, rgb(var(--c-bg) / 0.9))',
        }}
      />
    </div>
  );
}
