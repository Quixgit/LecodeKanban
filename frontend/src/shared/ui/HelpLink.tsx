import { CircleHelp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '../lib/cn';
import { helpPath } from '../lib/helpPath';

/** "Learn more in Help": a quiet link from a complex setting to its guide article. */
export function HelpLink({
  guide,
  article,
  className,
}: {
  guide: string;
  article?: string;
  className?: string;
}) {
  const { t } = useTranslation('help');
  return (
    <Link
      to={helpPath(guide, article)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-sm text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        className,
      )}
    >
      <CircleHelp className="size-4" aria-hidden />
      {t('guides.learnMore')}
    </Link>
  );
}
