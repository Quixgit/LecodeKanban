export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'en';

/** Translation namespaces; each maps to public/locales/<lng>/<ns>.json. */
export const NAMESPACES = [
  'common',
  'nav',
  'errors',
  'auth',
  'team',
  'projects',
  'tasks',
  'kanban',
  'card',
  'time',
  'calendar',
  'dashboard',
  'performance',
  'help',
  'onboarding',
  'wiki',
  'wikiEditor',
  'chat',
  'integrations',
  'profile',
  'fields',
  'settings',
  'memberCard',
  'showcase',
] as const;
export type Namespace = (typeof NAMESPACES)[number];

export const LANGUAGE_STORAGE_KEY = 'lk-lang';

export function isSupportedLanguage(v: string | undefined | null): v is Language {
  return !!v && (SUPPORTED_LANGUAGES as readonly string[]).includes(v);
}

/** Normalise browser tags like "uk-UA" or "en-GB" to a supported language. */
export function normalizeLanguage(tag: string | undefined | null): Language {
  const base = tag?.toLowerCase().split('-')[0];
  return isSupportedLanguage(base) ? base : DEFAULT_LANGUAGE;
}
