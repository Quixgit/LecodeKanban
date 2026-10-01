import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, useLanguage } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

/** Compact UK | EN toggle. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  return (
    <div
      role="radiogroup"
      aria-label={t('language.label')}
      className={cn(
        'flex h-10 items-center rounded-lg border border-border bg-surface p-1 shadow-xs',
        className,
      )}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <button
          key={lng}
          type="button"
          role="radio"
          aria-checked={language === lng}
          aria-label={t(`language.${lng}`)}
          onClick={() => void setLanguage(lng)}
          className={cn(
            'h-full rounded-md px-2 text-xs font-semibold uppercase transition-colors duration-micro',
            language === lng
              ? 'bg-primary-soft text-primary-ink'
              : 'text-text-muted hover:text-text',
          )}
        >
          {t(`language.short.${lng}`)}
        </button>
      ))}
    </div>
  );
}
