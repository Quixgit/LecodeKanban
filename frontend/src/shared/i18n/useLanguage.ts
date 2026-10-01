import { useTranslation } from 'react-i18next';
import { normalizeLanguage, type Language } from './config';

export function useLanguage() {
  const { i18n } = useTranslation();
  const language: Language = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  return {
    language,
    setLanguage: (lng: Language) => i18n.changeLanguage(lng),
  };
}
