import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enAuth from '../../public/locales/en/auth.json';
import enCommon from '../../public/locales/en/common.json';
import enErrors from '../../public/locales/en/errors.json';
import enNav from '../../public/locales/en/nav.json';
import enProjects from '../../public/locales/en/projects.json';
import enTasks from '../../public/locales/en/tasks.json';
import enDashboard from '../../public/locales/en/dashboard.json';
import enShowcase from '../../public/locales/en/showcase.json';
import enTeam from '../../public/locales/en/team.json';
import enWiki from '../../public/locales/en/wiki.json';
import enWikiEditor from '../../public/locales/en/wikiEditor.json';
import enChat from '../../public/locales/en/chat.json';
import enFields from '../../public/locales/en/fields.json';
import enMemberCard from '../../public/locales/en/memberCard.json';
import enSettings from '../../public/locales/en/settings.json';
import enProfile from '../../public/locales/en/profile.json';
import enIntegrations from '../../public/locales/en/integrations.json';
import ukAuth from '../../public/locales/uk/auth.json';
import ukCommon from '../../public/locales/uk/common.json';
import ukErrors from '../../public/locales/uk/errors.json';
import ukNav from '../../public/locales/uk/nav.json';
import ukProjects from '../../public/locales/uk/projects.json';
import ukTasks from '../../public/locales/uk/tasks.json';
import ukDashboard from '../../public/locales/uk/dashboard.json';
import ukShowcase from '../../public/locales/uk/showcase.json';
import ukTeam from '../../public/locales/uk/team.json';
import ukWiki from '../../public/locales/uk/wiki.json';
import ukWikiEditor from '../../public/locales/uk/wikiEditor.json';
import ukChat from '../../public/locales/uk/chat.json';
import ukFields from '../../public/locales/uk/fields.json';
import ukMemberCard from '../../public/locales/uk/memberCard.json';
import ukSettings from '../../public/locales/uk/settings.json';
import ukProfile from '../../public/locales/uk/profile.json';
import ukIntegrations from '../../public/locales/uk/integrations.json';

export const testResources = {
  en: {
    common: enCommon,
    nav: enNav,
    errors: enErrors,
    auth: enAuth,
    team: enTeam,
    projects: enProjects,
    tasks: enTasks,
    dashboard: enDashboard,
    showcase: enShowcase,
    wiki: enWiki,
    wikiEditor: enWikiEditor,
    chat: enChat,
    integrations: enIntegrations,
    profile: enProfile,
    fields: enFields,
    settings: enSettings,
    memberCard: enMemberCard,
  },
  uk: {
    common: ukCommon,
    nav: ukNav,
    errors: ukErrors,
    auth: ukAuth,
    team: ukTeam,
    projects: ukProjects,
    tasks: ukTasks,
    dashboard: ukDashboard,
    showcase: ukShowcase,
    wiki: ukWiki,
    wikiEditor: ukWikiEditor,
    chat: ukChat,
    integrations: ukIntegrations,
    profile: ukProfile,
    fields: ukFields,
    settings: ukSettings,
    memberCard: ukMemberCard,
  },
};

/** Synchronous i18n with bundled resources (no HTTP backend in tests). */
export function initTestI18n(lng: 'en' | 'uk') {
  return i18n.use(initReactI18next).init({
    lng,
    fallbackLng: 'en',
    resources: testResources,
    defaultNS: 'common',
    ns: ['common', 'nav', 'errors', 'auth', 'team', 'projects', 'tasks', 'dashboard', 'showcase'],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export { i18n };
