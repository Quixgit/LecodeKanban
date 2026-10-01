import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCommon from '../../public/locales/en/common.json';
import enNav from '../../public/locales/en/nav.json';
import enShowcase from '../../public/locales/en/showcase.json';
import ukCommon from '../../public/locales/uk/common.json';
import ukNav from '../../public/locales/uk/nav.json';
import ukShowcase from '../../public/locales/uk/showcase.json';

export const testResources = {
  en: { common: enCommon, nav: enNav, showcase: enShowcase },
  uk: { common: ukCommon, nav: ukNav, showcase: ukShowcase },
};

/** Synchronous i18n with bundled resources (no HTTP backend in tests). */
export function initTestI18n(lng: 'en' | 'uk') {
  return i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: testResources,
    defaultNS: 'common',
    ns: ['common', 'nav', 'showcase'],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export { i18n };
