import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
} from './config';

/**
 * Runtime i18n: namespaces are lazy-loaded over HTTP from /locales.
 * Detection order: explicit user choice (localStorage) → browser languages.
 * Once auth lands, the profile language overrides both (see changeLanguage).
 */
export function initI18n() {
  return i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: [...SUPPORTED_LANGUAGES],
      nonExplicitSupportedLngs: true,
      load: 'languageOnly',
      fallbackLng: DEFAULT_LANGUAGE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ['localStorage'],
        convertDetectedLanguage: (lng: string) => normalizeLanguage(lng),
      },
      interpolation: { escapeValue: false },
      returnNull: false,
    });
}

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = normalizeLanguage(lng);
});

export { i18n };
