import { useTranslation } from 'react-i18next';
import type { Viewer } from './header/UserMenu';

/**
 * The signed-in user shown in the header. Phase 1 has no auth backend yet,
 * so this returns an anonymous guest; the auth module replaces it.
 */
export function useViewer(): Viewer {
  const { t } = useTranslation();
  return { name: t('userMenu.guest') };
}
