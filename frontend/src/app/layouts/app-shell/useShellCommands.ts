import { Languages, LayoutTemplate, Moon, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Command } from '@/features/command-palette';
import { useLanguage } from '@/shared/i18n';
import { useTheme } from '@/shared/theme';
import { useNavigation } from './useNavigation';

/** Global commands: jump to any page, switch theme / language. */
export function useShellCommands(): Command[] {
  const { t } = useTranslation(['nav', 'common']);
  const navigate = useNavigate();
  const navigation = useNavigation();
  const { resolved, toggle } = useTheme();
  const { language, setLanguage } = useLanguage();

  return useMemo(() => {
    const goTo = t('common:commandPalette.groups.navigation');
    const nav: Command[] = navigation.flatMap((section) =>
      section.items.flatMap((item) => [
        {
          id: `nav-${item.key}`,
          label: t(`nav:items.${item.key}`),
          group: goTo,
          icon: item.icon,
          keywords: [item.key],
          run: () => navigate(item.to),
        },
        ...(item.children ?? []).map((child) => ({
          id: `nav-${item.key}-${child.key}`,
          label: `${t(`nav:items.${item.key}`)} › ${t(`nav:tasks.${child.key}`)}`,
          group: goTo,
          icon: item.icon,
          keywords: [child.key],
          run: () => navigate(child.to),
        })),
      ]),
    );
    const prefs = t('common:commandPalette.groups.preferences');
    return [
      ...nav,
      {
        id: 'nav-ui-kit',
        label: t('common:userMenu.uiKit'),
        group: goTo,
        icon: LayoutTemplate,
        keywords: ['design', 'components', 'storybook'],
        run: () => navigate('/ui-kit'),
      },
      {
        id: 'theme-toggle',
        label:
          resolved === 'dark' ? t('common:theme.switchToLight') : t('common:theme.switchToDark'),
        group: prefs,
        icon: resolved === 'dark' ? Sun : Moon,
        keywords: ['theme', 'dark', 'light'],
        run: toggle,
      },
      {
        id: 'lang-toggle',
        label: t('common:language.switchTo', {
          // Not `lng`: that key is an i18next option and would force the output language.
          language: t(`common:language.${language === 'en' ? 'uk' : 'en'}`),
        }),
        group: prefs,
        icon: Languages,
        keywords: ['language', 'мова', 'english', 'українська'],
        run: () => void setLanguage(language === 'en' ? 'uk' : 'en'),
      },
    ];
  }, [t, navigate, navigation, resolved, toggle, language, setLanguage]);
}
