import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router-dom';
import { useSession } from '@/features/auth';
import { fadeUp } from '@/shared/motion';

export interface RouteHandle {
  /** i18n keys in the `nav` namespace. */
  titleKey: string;
  subtitleKey?: string;
}

function isRouteHandle(h: unknown): h is RouteHandle {
  return typeof h === 'object' && h !== null && 'titleKey' in h;
}

/** Title + subtitle of the deepest route that declares a handle. */
export function PageTitle() {
  const { t } = useTranslation('nav');
  const { user } = useSession();
  const matches = useMatches();
  // Titles may greet the user ("Hello, {{name}}!") — first name only.
  const name = user?.name.split(/\s+/)[0] ?? '';
  const handle = [...matches]
    .reverse()
    .map((m) => m.handle)
    .find(isRouteHandle);
  if (!handle) return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={handle.titleKey}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="min-w-0"
      >
        <h1 className="truncate text-md font-semibold leading-5 text-text">
          {t(handle.titleKey, { name })}
        </h1>
        {handle.subtitleKey && (
          <p className="line-clamp-2 hidden text-sm leading-4 text-text-secondary md:block">
            {t(handle.subtitleKey)}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
