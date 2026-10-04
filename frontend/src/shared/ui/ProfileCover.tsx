import { cn } from '../lib/cn';
import { COVER_PRESETS, isCoverPreset } from './coverPresets';

/** A person's profile background: their picture, else the preset they chose, else a soft default. */
export function ProfileCover({
  url,
  preset,
  className,
}: {
  url?: string | null;
  preset?: string;
  className?: string;
}) {
  if (url) {
    return (
      <div
        role="img"
        aria-hidden
        className={cn('bg-surface-muted bg-cover bg-center', className)}
        style={{ backgroundImage: `url("${url}")` }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'bg-gradient-to-r',
        preset && isCoverPreset(preset)
          ? COVER_PRESETS[preset]
          : 'from-primary-subtle via-surface-muted to-primary-subtle',
        className,
      )}
    />
  );
}
