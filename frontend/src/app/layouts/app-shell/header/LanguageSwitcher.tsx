import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, useLanguage, type Language } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';

/** Compact UK | EN toggle. `onChange` lets the shell persist the choice to the profile. */
export function LanguageSwitcher({
  className,
  onChange,
}: {
  className?: string;
  onChange?: (lng: Language) => void;
}) {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguage();
  const select = onChange ?? ((lng: Language) => void setLanguage(lng));
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
          onClick={() => select(lng)}
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
