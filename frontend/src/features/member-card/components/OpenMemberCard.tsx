import { useMemberCardStore } from '../store/memberCardStore';
import { cn } from '@/shared/lib/cn';

/** Wraps a name or avatar so that a click opens that teammate's profile card. */
export function OpenMemberCard({
  userId,
  label,
  children,
  className,
}: {
  userId: string;
  /** Accessible name, e.g. "Open Anna's profile". */
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const open = useMemberCardStore((s) => s.open);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        open(userId);
      }}
      className={cn(
        'inline-flex min-w-0 items-center rounded outline-none transition-colors duration-micro hover:text-primary-ink focus-visible:shadow-focus',
        className,
      )}
    >
      {children}
    </button>
  );
}
