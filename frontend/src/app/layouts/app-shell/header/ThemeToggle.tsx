import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { transition } from '@/shared/motion';
import { useTheme } from '@/shared/theme';
import { IconButton } from '@/shared/ui';

export function ThemeToggle() {
  const { t } = useTranslation();
  const { resolved, toggle } = useTheme();
  const dark = resolved === 'dark';
  return (
    <IconButton
      label={dark ? t('theme.switchToLight') : t('theme.switchToDark')}
      onClick={toggle}
      className="overflow-hidden"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolved}
          initial={{ y: 12, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -12, opacity: 0, rotate: 30 }}
          transition={transition.ui}
          className="flex"
        >
          {dark ? <Moon /> : <Sun />}
        </motion.span>
      </AnimatePresence>
    </IconButton>
  );
}
